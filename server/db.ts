import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  jobs,
  priceBookItems,
  quoteLineItems,
  quotePhotos,
  quotes,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateQuoteJobTotal } from "./jobSnapshot";

let _db: ReturnType<typeof drizzle> | null = null;

export type QuoteLinePayload = {
  category: "labour" | "materials" | "callout" | "equipment" | "other";
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  markupPercent: number;
  sortOrder: number;
};

export type PersistedPhotoPayload = {
  storageKey: string;
  url: string;
  fileName: string;
};

export type QuotePayload = {
  quoteNumber: string;
  status: "draft" | "ready" | "sent";
  businessName?: string | null;
  businessAbn?: string | null;
  businessLicence?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  trade: string;
  jobTitle: string;
  jobAddress?: string | null;
  siteDetails?: string | null;
  scopeOfWork?: string | null;
  assumptions?: string | null;
  exclusions?: string | null;
  terms?: string | null;
  gstRate: number;
  validUntil?: Date | null;
  lineItems: QuoteLinePayload[];
  photos: PersistedPhotoPayload[];
};

export type PriceBookPayload = {
  category: "labour" | "materials" | "callout" | "equipment" | "other";
  name: string;
  description?: string | null;
  unit: string;
  rate: number;
  markupPercent: number;
  trade: string;
  status: "active" | "archived";
};

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const lineValues = (quoteId: number, lineItems: QuoteLinePayload[]) =>
  lineItems.map(item => ({
    quoteId,
    category: item.category,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity.toFixed(2),
    rate: item.rate.toFixed(2),
    markupPercent: item.markupPercent.toFixed(2),
    sortOrder: item.sortOrder,
  }));

export async function getQuotesForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.select().from(quotes).where(eq(quotes.userId, userId)).orderBy(desc(quotes.updatedAt));
}

export async function getQuoteDetailForUser(quoteId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const quote = (await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId))).limit(1))[0];
  if (!quote) return undefined;
  const [lineItems, photos] = await Promise.all([
    db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId)).orderBy(quoteLineItems.sortOrder),
    db.select().from(quotePhotos).where(eq(quotePhotos.quoteId, quoteId)),
  ]);
  return { quote, lineItems, photos };
}

export async function createQuoteForUser(userId: number, payload: QuotePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const created = await db.insert(quotes).values({
    userId,
    quoteNumber: payload.quoteNumber,
    status: payload.status,
    businessName: payload.businessName ?? null,
    businessAbn: payload.businessAbn ?? null,
    businessLicence: payload.businessLicence ?? null,
    businessPhone: payload.businessPhone ?? null,
    businessEmail: payload.businessEmail ?? null,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail ?? null,
    customerPhone: payload.customerPhone ?? null,
    trade: payload.trade,
    jobTitle: payload.jobTitle,
    jobAddress: payload.jobAddress ?? null,
    siteDetails: payload.siteDetails ?? null,
    scopeOfWork: payload.scopeOfWork ?? null,
    assumptions: payload.assumptions ?? null,
    exclusions: payload.exclusions ?? null,
    terms: payload.terms ?? null,
    gstRate: payload.gstRate.toFixed(2),
    validUntil: payload.validUntil ?? null,
  }).$returningId();
  const quoteId = Number(created[0]?.id);
  if (!quoteId) throw new Error("Quote could not be created");
  if (payload.lineItems.length) await db.insert(quoteLineItems).values(lineValues(quoteId, payload.lineItems));
  if (payload.photos.length) await db.insert(quotePhotos).values(payload.photos.map(photo => ({ quoteId, ...photo })));
  return getQuoteDetailForUser(quoteId, userId);
}

export async function updateQuoteForUser(quoteId: number, userId: number, payload: QuotePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = await getQuoteDetailForUser(quoteId, userId);
  if (!existing) return undefined;

  await db.transaction(async tx => {
    await tx.update(quotes).set({
      status: payload.status,
      businessName: payload.businessName ?? null,
      businessAbn: payload.businessAbn ?? null,
      businessLicence: payload.businessLicence ?? null,
      businessPhone: payload.businessPhone ?? null,
      businessEmail: payload.businessEmail ?? null,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail ?? null,
      customerPhone: payload.customerPhone ?? null,
      trade: payload.trade,
      jobTitle: payload.jobTitle,
      jobAddress: payload.jobAddress ?? null,
      siteDetails: payload.siteDetails ?? null,
      scopeOfWork: payload.scopeOfWork ?? null,
      assumptions: payload.assumptions ?? null,
      exclusions: payload.exclusions ?? null,
      terms: payload.terms ?? null,
      gstRate: payload.gstRate.toFixed(2),
      validUntil: payload.validUntil ?? null,
      updatedAt: new Date(),
    }).where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId)));
    await tx.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
    if (payload.lineItems.length) await tx.insert(quoteLineItems).values(lineValues(quoteId, payload.lineItems));
    await tx.delete(quotePhotos).where(eq(quotePhotos.quoteId, quoteId));
    if (payload.photos.length) await tx.insert(quotePhotos).values(payload.photos.map(photo => ({ quoteId, ...photo })));
  });
  return getQuoteDetailForUser(quoteId, userId);
}

export async function duplicateQuoteForUser(sourceQuoteId: number, userId: number) {
  const source = await getQuoteDetailForUser(sourceQuoteId, userId);
  if (!source) return undefined;
  const quote = source.quote;
  return createQuoteForUser(userId, {
    quoteNumber: `TQ-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    status: "draft",
    businessName: quote.businessName,
    businessAbn: quote.businessAbn,
    businessLicence: quote.businessLicence,
    businessPhone: quote.businessPhone,
    businessEmail: quote.businessEmail,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    trade: quote.trade,
    jobTitle: `${quote.jobTitle} — Copy`.slice(0, 220),
    jobAddress: quote.jobAddress,
    siteDetails: quote.siteDetails,
    scopeOfWork: quote.scopeOfWork,
    assumptions: quote.assumptions,
    exclusions: quote.exclusions,
    terms: quote.terms,
    gstRate: Number(quote.gstRate),
    validUntil: quote.validUntil,
    lineItems: source.lineItems.map((item, index) => ({
      category: item.category,
      description: item.description,
      unit: item.unit,
      quantity: Number(item.quantity),
      rate: Number(item.rate),
      markupPercent: Number(item.markupPercent),
      sortOrder: index,
    })),
    photos: source.photos.map(photo => ({
      storageKey: photo.storageKey,
      url: photo.url,
      fileName: photo.fileName,
    })),
  });
}

export async function getPriceBookItemsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.select().from(priceBookItems).where(eq(priceBookItems.userId, userId)).orderBy(desc(priceBookItems.updatedAt));
}

export async function createPriceBookItemForUser(userId: number, payload: PriceBookPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const created = await db.insert(priceBookItems).values({
    userId,
    category: payload.category,
    name: payload.name,
    description: payload.description ?? null,
    unit: payload.unit,
    rate: payload.rate.toFixed(2),
    markupPercent: payload.markupPercent.toFixed(2),
    trade: payload.trade,
    status: payload.status,
  }).$returningId();
  const itemId = Number(created[0]?.id);
  return (await db.select().from(priceBookItems).where(and(eq(priceBookItems.id, itemId), eq(priceBookItems.userId, userId))).limit(1))[0];
}

export async function updatePriceBookItemForUser(itemId: number, userId: number, payload: PriceBookPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(priceBookItems).set({
    category: payload.category,
    name: payload.name,
    description: payload.description ?? null,
    unit: payload.unit,
    rate: payload.rate.toFixed(2),
    markupPercent: payload.markupPercent.toFixed(2),
    trade: payload.trade,
    status: payload.status,
    updatedAt: new Date(),
  }).where(and(eq(priceBookItems.id, itemId), eq(priceBookItems.userId, userId)));
  return (await db.select().from(priceBookItems).where(and(eq(priceBookItems.id, itemId), eq(priceBookItems.userId, userId))).limit(1))[0];
}

export async function getJobsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.updatedAt));
}

export async function createJobFromQuoteForUser(quoteId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = (await db.select().from(jobs).where(and(eq(jobs.sourceQuoteId, quoteId), eq(jobs.userId, userId))).limit(1))[0];
  if (existing) return existing;
  const source = await getQuoteDetailForUser(quoteId, userId);
  if (!source) return undefined;
  const jobTotal = calculateQuoteJobTotal(source.lineItems, source.quote.gstRate);
  const created = await db.insert(jobs).values({
    userId,
    sourceQuoteId: quoteId,
    jobNumber: `JOB-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    status: "planned",
    customerName: source.quote.customerName,
    trade: source.quote.trade,
    title: source.quote.jobTitle,
    address: source.quote.jobAddress,
    scopeOfWork: source.quote.scopeOfWork,
    quotedTotal: jobTotal.toFixed(2),
    gstRate: Number(source.quote.gstRate).toFixed(2),
  }).$returningId();
  const jobId = Number(created[0]?.id);
  return (await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1))[0];
}

export async function updateJobStatusForUser(jobId: number, userId: number, status: "planned" | "active" | "on_hold" | "complete") {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(jobs).set({ status, updatedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
  return (await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1))[0];
}
