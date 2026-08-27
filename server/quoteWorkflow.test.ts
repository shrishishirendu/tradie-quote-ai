import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  createQuoteForUser: vi.fn(),
  duplicateQuoteForUser: vi.fn(),
  getQuoteDetailForUser: vi.fn(),
  getQuotesForUser: vi.fn(),
  updateQuoteForUser: vi.fn(),
}));

vi.mock("./db", () => dbMock);

import { appRouter, quoteInputSchema } from "./routers";
import type { TrpcContext } from "./_core/context";

const validQuote = {
  status: "draft" as const,
  businessName: "Harbour Plumbing Co.",
  businessAbn: "12 345 678 901",
  businessLicence: "PL-12345",
  businessPhone: "02 9000 0000",
  businessEmail: "hello@harbourplumbing.com.au",
  customerName: "Morgan Lee",
  customerEmail: "morgan@example.com",
  customerPhone: "0400 000 000",
  trade: "Plumbing",
  jobTitle: "Kitchen mixer replacement",
  jobAddress: "10 Harbour Road, Sydney NSW 2000",
  siteDetails: "Mixer is accessible from the under-sink cabinet.",
  scopeOfWork: "Supply and replace one kitchen mixer.",
  assumptions: "• Existing isolation valves operate correctly.",
  exclusions: "• Rectification of concealed pipework.",
  terms: "Valid for 14 days.",
  gstRate: 10,
  validUntil: "2026-09-10",
  lineItems: [{ category: "labour" as const, description: "Plumbing labour", unit: "hour", quantity: 1.5, rate: 120, markupPercent: 0, sortOrder: 0 }],
  photos: [],
};

function unauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function authenticatedContext(userId = 42): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `tradie-${userId}`,
      name: "Sam Tradie",
      email: "sam@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("quote workflow boundaries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a complete editable Australian quote payload", () => {
    expect(quoteInputSchema.safeParse(validQuote).success).toBe(true);
  });

  it("rejects unsafe quote inputs before they reach persistence", () => {
    const malformed = { ...validQuote, customerEmail: "not-an-email", lineItems: [{ ...validQuote.lineItems[0], quantity: -1 }] };
    expect(quoteInputSchema.safeParse(malformed).success).toBe(false);
  });

  it("requires authenticated access to user-owned quote history", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.quote.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("scopes quote listing and retrieval to the signed-in tradie", async () => {
    dbMock.getQuotesForUser.mockResolvedValue([]);
    dbMock.getQuoteDetailForUser.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(authenticatedContext(42));

    await expect(caller.quote.list()).resolves.toEqual([]);
    await expect(caller.quote.get({ id: 18 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(dbMock.getQuotesForUser).toHaveBeenCalledWith(42);
    expect(dbMock.getQuoteDetailForUser).toHaveBeenCalledWith(18, 42);
  });

  it("uses the signed-in tradie identifier when saving, updating, and duplicating", async () => {
    const savedQuote = { quote: { id: 77 }, lineItems: [], photos: [] };
    dbMock.createQuoteForUser.mockResolvedValue(savedQuote);
    dbMock.updateQuoteForUser.mockResolvedValue(savedQuote);
    dbMock.duplicateQuoteForUser.mockResolvedValue(savedQuote);
    const caller = appRouter.createCaller(authenticatedContext(42));

    await expect(caller.quote.create(validQuote)).resolves.toEqual(savedQuote);
    await expect(caller.quote.update({ id: 18, data: validQuote })).resolves.toEqual(savedQuote);
    await expect(caller.quote.duplicate({ id: 18 })).resolves.toEqual(savedQuote);

    expect(dbMock.createQuoteForUser).toHaveBeenCalledWith(42, expect.objectContaining({ customerName: "Morgan Lee" }));
    expect(dbMock.updateQuoteForUser).toHaveBeenCalledWith(18, 42, expect.objectContaining({ customerName: "Morgan Lee" }));
    expect(dbMock.duplicateQuoteForUser).toHaveBeenCalledWith(18, 42);
  });
});
