import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  getDb,
  getFieldDashboardSummaryForUser,
  getJobsForUser,
  getPaymentRequestsForJob,
  getPriceBookItemsForUser,
  getQuoteDetailForUser,
  getQuotesForUser,
  getVariationsForJob,
  createJobFromQuoteForUser,
  createPaymentRequestForUser,
  createQuoteAcceptanceForUser,
  createVariationForUser,
  setPaymentCheckoutSessionForUser,
  updateJobStatusForUser,
  updatePriceBookItemForUser,
  updateQuoteForUser,
  updateVariationStatusForUser,
} from "./db";
import { users, organizations, quotes, priceBookItems, jobs, quoteAcceptances, variations, paymentRequests } from "../drizzle/schema";

// This test uses the real persistence layer through a helper module so the tenant boundary
// is verified at runtime rather than by inspecting source text or mocking ownership checks.

describe("runtime organization isolation", { timeout: 30_000 }, () => {
  let userA: number;
  let userB: number;
  let organizationA: number;
  let organizationB: number;
  let quoteA: number;
  let quoteB: number;
  let priceBookA: number;
  let priceBookB: number;
  let jobA: number;
  let jobB: number;
  let variationA: number;
  let variationB: number;
  let paymentA: number;
  let paymentB: number;
  let acceptanceA: number;
  let acceptanceB: number;
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeAll(async () => {
    db = await getDb();
    expect(db, "DATABASE_URL must be available for the runtime isolation test").toBeTruthy();
    if (!db) return;

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userRows = await db.insert(users).values([
      { openId: `runtime-isolation-a-${suffix}`, name: "Isolation A", email: `isolation-a-${suffix}@example.test`, role: "user" },
      { openId: `runtime-isolation-b-${suffix}`, name: "Isolation B", email: `isolation-b-${suffix}@example.test`, role: "user" },
    ]).$returningId();
    userA = Number(userRows[0]!.id);
    userB = Number(userRows[1]!.id);

    const organizationRows = await db.insert(organizations).values([
      { ownerUserId: userA, name: `Runtime Org A ${suffix}` },
      { ownerUserId: userB, name: `Runtime Org B ${suffix}` },
    ]).$returningId();
    organizationA = Number(organizationRows[0]!.id);
    organizationB = Number(organizationRows[1]!.id);

    const quoteRows = await db.insert(quotes).values([
      { userId: userA, organizationId: organizationA, quoteNumber: `ISO-A-${suffix}`, status: "draft", customerName: "Customer A", trade: "Plumbing", jobTitle: "Org A job", gstRate: "10.00" },
      { userId: userB, organizationId: organizationB, quoteNumber: `ISO-B-${suffix}`, status: "draft", customerName: "Customer B", trade: "Electrical", jobTitle: "Org B job", gstRate: "10.00" },
    ]).$returningId();
    quoteA = Number(quoteRows[0]!.id);
    quoteB = Number(quoteRows[1]!.id);

    const priceRows = await db.insert(priceBookItems).values([
      { userId: userA, organizationId: organizationA, category: "labour", name: `Isolation labour A ${suffix}`, unit: "hour", rate: "100.00", markupPercent: "0.00", trade: "Plumbing", status: "active" },
      { userId: userB, organizationId: organizationB, category: "labour", name: `Isolation labour B ${suffix}`, unit: "hour", rate: "200.00", markupPercent: "0.00", trade: "Electrical", status: "active" },
    ]).$returningId();
    priceBookA = Number(priceRows[0]!.id);
    priceBookB = Number(priceRows[1]!.id);

    const jobRows = await db.insert(jobs).values([
      { userId: userA, organizationId: organizationA, sourceQuoteId: quoteA, jobNumber: `ISO-JOB-A-${suffix}`, status: "planned", customerName: "Customer A", trade: "Plumbing", title: "Org A job", quotedTotal: "110.00", gstRate: "10.00" },
      { userId: userB, organizationId: organizationB, sourceQuoteId: quoteB, jobNumber: `ISO-JOB-B-${suffix}`, status: "planned", customerName: "Customer B", trade: "Electrical", title: "Org B job", quotedTotal: "220.00", gstRate: "10.00" },
    ]).$returningId();
    jobA = Number(jobRows[0]!.id);
    jobB = Number(jobRows[1]!.id);

    const variationRows = await db.insert(variations).values([
      { jobId: jobA, userId: userA, organizationId: organizationA, variationNumber: `ISO-VAR-A-${suffix}`, title: "Variation A", scopeOfWork: "Org A variation", status: "draft", subtotal: "10.00", gstAmount: "1.00", total: "11.00" },
      { jobId: jobB, userId: userB, organizationId: organizationB, variationNumber: `ISO-VAR-B-${suffix}`, title: "Variation B", scopeOfWork: "Org B variation", status: "draft", subtotal: "20.00", gstAmount: "2.00", total: "22.00" },
    ]).$returningId();
    variationA = Number(variationRows[0]!.id);
    variationB = Number(variationRows[1]!.id);

    const paymentRows = await db.insert(paymentRequests).values([
      { jobId: jobA, userId: userA, organizationId: organizationA, paymentNumber: `ISO-PAY-A-${suffix}`, kind: "deposit", title: "Deposit A", requestedAmountCents: 1100 },
      { jobId: jobB, userId: userB, organizationId: organizationB, paymentNumber: `ISO-PAY-B-${suffix}`, kind: "invoice", title: "Invoice B", requestedAmountCents: 2200 },
    ]).$returningId();
    paymentA = Number(paymentRows[0]!.id);
    paymentB = Number(paymentRows[1]!.id);

    const acceptanceRows = await db.insert(quoteAcceptances).values([
      { quoteId: quoteA, userId: userA, organizationId: organizationA, publicToken: `iso-accept-a-${suffix}`, status: "pending", recipientName: "Customer A", quoteSnapshot: "{}", snapshotHash: "a".repeat(64) },
      { quoteId: quoteB, userId: userB, organizationId: organizationB, publicToken: `iso-accept-b-${suffix}`, status: "pending", recipientName: "Customer B", quoteSnapshot: "{}", snapshotHash: "b".repeat(64) },
    ]).$returningId();
    acceptanceA = Number(acceptanceRows[0]!.id);
    acceptanceB = Number(acceptanceRows[1]!.id);
  });

  afterAll(async () => {
    if (!db) return;
    await db.delete(paymentRequests).where(eq(paymentRequests.id, paymentA));
    await db.delete(paymentRequests).where(eq(paymentRequests.id, paymentB));
    await db.delete(variations).where(eq(variations.id, variationA));
    await db.delete(variations).where(eq(variations.id, variationB));
    await db.delete(quoteAcceptances).where(eq(quoteAcceptances.id, acceptanceA));
    await db.delete(quoteAcceptances).where(eq(quoteAcceptances.id, acceptanceB));
    await db.delete(jobs).where(eq(jobs.id, jobA));
    await db.delete(jobs).where(eq(jobs.id, jobB));
    await db.delete(priceBookItems).where(eq(priceBookItems.id, priceBookA));
    await db.delete(priceBookItems).where(eq(priceBookItems.id, priceBookB));
    await db.delete(quotes).where(eq(quotes.id, quoteA));
    await db.delete(quotes).where(eq(quotes.id, quoteB));
    await db.delete(organizations).where(eq(organizations.id, organizationA));
    await db.delete(organizations).where(eq(organizations.id, organizationB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  it("keeps all business reads and parent-child lookups inside the current organization", async () => {
    expect((await getQuotesForUser(userA)).map(row => row.id)).toEqual([quoteA]);
    expect((await getQuotesForUser(userB)).map(row => row.id)).toEqual([quoteB]);
    expect(await getQuoteDetailForUser(quoteB, userA)).toBeUndefined();
    expect((await getPriceBookItemsForUser(userA)).map(row => row.id)).toEqual([priceBookA]);
    expect((await getPriceBookItemsForUser(userB)).map(row => row.id)).toEqual([priceBookB]);
    expect((await getJobsForUser(userA)).map(row => row.id)).toEqual([jobA]);
    expect((await getJobsForUser(userB)).map(row => row.id)).toEqual([jobB]);
    expect(await getVariationsForJob(jobB, userA)).toBeUndefined();
    expect(await getPaymentRequestsForJob(jobB, userA)).toEqual([]);
    expect((await getFieldDashboardSummaryForUser(userA)).pendingApprovals).toBe(1);
  });

  it("rejects cross-organization writes and leaves the other organization unchanged", async () => {
    expect(await updateQuoteForUser(quoteB, userA, { quoteNumber: "blocked", status: "ready", customerName: "Blocked", trade: "Plumbing", jobTitle: "Blocked", gstRate: 10, lineItems: [], photos: [] })).toBeUndefined();
    expect(await updatePriceBookItemForUser(priceBookB, userA, { category: "labour", name: "Blocked", unit: "hour", rate: 1, markupPercent: 0, trade: "Plumbing", status: "active" })).toBeUndefined();
    expect(await updateJobStatusForUser(jobB, userA, "complete")).toBeUndefined();
    expect(await updateVariationStatusForUser(variationB, userA, "approved")).toBeUndefined();
    expect(await setPaymentCheckoutSessionForUser(paymentB, userA, "cs_blocked")).toBeUndefined();
    expect(await createJobFromQuoteForUser(quoteB, userA)).toBeUndefined();
    expect(await createVariationForUser(jobB, userA, { title: "Blocked", scopeOfWork: "Blocked", status: "draft", subtotal: 1, gstAmount: 0.1, total: 1.1, photos: [] })).toBeUndefined();
    expect(await createPaymentRequestForUser(jobB, userA, { kind: "deposit", title: "Blocked", requestedAmountCents: 1 })).toBeUndefined();
    expect(await createQuoteAcceptanceForUser(quoteB, userA)).toBeUndefined();

    expect((await getJobsForUser(userB)).find(row => row.id === jobB)?.status).toBe("planned");
    expect((await getPriceBookItemsForUser(userB)).find(row => row.id === priceBookB)?.name).toContain("Isolation labour B");
    expect((await getPaymentRequestsForJob(jobB, userB)).find(row => row.id === paymentB)?.stripeCheckoutSessionId).toBeNull();
    expect((await getVariationsForJob(jobB, userB))?.variations.find(row => row.id === variationB)?.status).toBe("draft");
    expect((await getQuoteDetailForUser(quoteB, userB))?.quote.customerName).toBe("Customer B");
    expect((await getQuoteDetailForUser(quoteB, userB))?.quote.id).toBe(quoteB);
    expect(acceptanceA).not.toBe(acceptanceB);
  });
});
