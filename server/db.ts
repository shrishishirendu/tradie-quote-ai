import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import {
  InsertUser,
  jobs,
  organizations,
  paymentRequests,
  priceBookItems,
  quoteAcceptances,
  quoteLineItems,
  quotePhotos,
  quotes,
  users,
  variationPhotos,
  variations,
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

export type VariationPhotoPayload = PersistedPhotoPayload;

export type VariationPayload = {
  title: string;
  reason?: string | null;
  scopeOfWork: string;
  status: "draft" | "sent" | "approved" | "declined";
  subtotal: number;
  gstAmount: number;
  total: number;
  photos: VariationPhotoPayload[];
};

export type OrganizationIdentityPayload = {
  businessName?: string | null;
  businessAbn?: string | null;
  businessLicence?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
};

export type PaymentRequestPayload = {
  kind: "deposit" | "invoice";
  title: string;
  description?: string | null;
  requestedAmountCents: number;
  dueDate?: Date | null;
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

async function getOrganizationForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return (await db.select().from(organizations).where(eq(organizations.ownerUserId, userId)).limit(1))[0];
}

async function upsertOrganizationForUser(userId: number, payload: OrganizationIdentityPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = await getOrganizationForUser(userId);
  const values = {
    ownerUserId: userId,
    name: payload.businessName?.trim() || existing?.name || `Business ${userId}`,
    abn: payload.businessAbn ?? null,
    licence: payload.businessLicence ?? null,
    phone: payload.businessPhone ?? null,
    email: payload.businessEmail ?? null,
  };
  if (existing) {
    await db.update(organizations).set({ ...values, updatedAt: new Date() }).where(eq(organizations.id, existing.id));
    return { ...existing, ...values };
  }
  const created = await db.insert(organizations).values(values).$returningId();
  const organizationId = Number(created[0]?.id);
  if (!organizationId) throw new Error("Organization could not be created");
  return (await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1))[0];
}

function withOrganizationIdentity<T extends { organizationId: number }>(quote: T, organization: typeof organizations.$inferSelect | undefined) {
  return {
    ...quote,
    businessName: organization?.name ?? null,
    businessAbn: organization?.abn ?? null,
    businessLicence: organization?.licence ?? null,
    businessPhone: organization?.phone ?? null,
    businessEmail: organization?.email ?? null,
  };
}

export async function getQuotesForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const rows = await db.select({ quote: quotes, organization: organizations }).from(quotes).leftJoin(organizations, eq(quotes.organizationId, organizations.id)).where(eq(quotes.userId, userId)).orderBy(desc(quotes.updatedAt));
  return rows.map(row => withOrganizationIdentity(row.quote, row.organization ?? undefined));
}

export async function getQuoteDetailForUser(quoteId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const row = (await db.select({ quote: quotes, organization: organizations }).from(quotes).leftJoin(organizations, eq(quotes.organizationId, organizations.id)).where(and(eq(quotes.id, quoteId), eq(quotes.userId, userId))).limit(1))[0];
  if (!row) return undefined;
  const [lineItems, photos] = await Promise.all([
    db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId)).orderBy(quoteLineItems.sortOrder),
    db.select().from(quotePhotos).where(eq(quotePhotos.quoteId, quoteId)),
  ]);
  return { quote: withOrganizationIdentity(row.quote, row.organization ?? undefined), lineItems, photos };
}

export async function createQuoteForUser(userId: number, payload: QuotePayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const organization = await upsertOrganizationForUser(userId, payload);
  if (!organization) throw new Error("Organization could not be resolved");
  const created = await db.insert(quotes).values({
    userId,
    organizationId: organization.id,
    quoteNumber: payload.quoteNumber,
    status: payload.status,
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

  const organization = await upsertOrganizationForUser(userId, payload);
  await db.transaction(async tx => {
    await tx.update(quotes).set({
      status: payload.status,
      organizationId: organization.id,
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

export type PriceBookImportRecord = { name: string; description: string; category: "labour" | "materials" | "callout" | "equipment" | "other"; trade: string; unit: string; rate: number; markupPercent: number; decision: "create" | "update" | "skip"; duplicateId?: number };

export async function batchImportPriceBookForUser(userId: number, records: PriceBookImportRecord[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const summary = { created: 0, updated: 0, skipped: 0 };
  await db.transaction(async tx => {
    for (const record of records) {
      if (record.decision === "skip") { summary.skipped += 1; continue; }
      const values = { category: record.category, name: record.name.trim(), description: record.description.trim() || null, unit: record.unit.trim(), rate: record.rate.toFixed(2), markupPercent: record.markupPercent.toFixed(2), trade: record.trade.trim(), updatedAt: new Date() };
      if (record.decision === "update") {
        if (!record.duplicateId) throw new Error("An update row is missing its duplicate item");
        const updated = await tx.update(priceBookItems).set(values).where(and(eq(priceBookItems.id, record.duplicateId), eq(priceBookItems.userId, userId), eq(priceBookItems.status, "active")));
        if (updated[0].affectedRows !== 1) throw new Error(`Price book item ${record.duplicateId} is no longer active`);
        summary.updated += 1;
      } else {
        await tx.insert(priceBookItems).values({ userId, ...values, status: "active" });
        summary.created += 1;
      }
    }
  });
  return summary;
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

export async function createQuoteAcceptanceForUser(quoteId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const source = await getQuoteDetailForUser(quoteId, userId);
  if (!source) return undefined;
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const snapshot = JSON.stringify({
    quote: source.quote,
    lineItems: source.lineItems,
    totals: calculateQuoteJobTotal(source.lineItems, source.quote.gstRate),
  });
  const snapshotHash = createHash("sha256").update(snapshot).digest("hex");
  const created = await db.insert(quoteAcceptances).values({
    quoteId,
    userId,
    publicToken: token,
    status: "pending",
    recipientName: source.quote.customerName,
    recipientEmail: source.quote.customerEmail,
    quoteSnapshot: snapshot,
    snapshotHash,
  }).$returningId();
  const id = Number(created[0]?.id);
  return (await db.select().from(quoteAcceptances).where(and(eq(quoteAcceptances.id, id), eq(quoteAcceptances.userId, userId))).limit(1))[0];
}

export async function getPublicQuoteAcceptance(publicToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return (await db.select().from(quoteAcceptances).where(eq(quoteAcceptances.publicToken, publicToken)).limit(1))[0];
}

export async function respondToQuoteAcceptance(publicToken: string, decision: "accepted" | "declined", signer: { name: string; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = await getPublicQuoteAcceptance(publicToken);
  if (!existing || existing.status !== "pending") return undefined;
  await db.update(quoteAcceptances).set({
    status: decision,
    acceptedName: decision === "accepted" ? signer.name : null,
    acceptedEmail: decision === "accepted" ? signer.email ?? null : null,
    acceptedAt: decision === "accepted" ? new Date() : null,
    updatedAt: new Date(),
  }).where(and(eq(quoteAcceptances.id, existing.id), eq(quoteAcceptances.status, "pending")));
  return getPublicQuoteAcceptance(publicToken);
}

export async function getVariationsForJob(jobId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const job = (await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1))[0];
  if (!job) return undefined;
  const records = await db.select().from(variations).where(and(eq(variations.jobId, jobId), eq(variations.userId, userId))).orderBy(desc(variations.updatedAt));
  const photos = records.length ? await db.select().from(variationPhotos).where(eq(variationPhotos.variationId, records[0]!.id)) : [];
  return { job, variations: records, photos };
}

export async function createVariationForUser(jobId: number, userId: number, payload: VariationPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const job = (await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1))[0];
  if (!job) return undefined;
  const created = await db.insert(variations).values({
    jobId,
    userId,
    variationNumber: `VAR-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    title: payload.title,
    reason: payload.reason ?? null,
    scopeOfWork: payload.scopeOfWork,
    status: payload.status,
    subtotal: payload.subtotal.toFixed(2),
    gstAmount: payload.gstAmount.toFixed(2),
    total: payload.total.toFixed(2),
    sentAt: payload.status === "sent" ? new Date() : null,
  }).$returningId();
  const variationId = Number(created[0]?.id);
  if (payload.photos.length) await db.insert(variationPhotos).values(payload.photos.map(photo => ({ variationId, ...photo })));
  return (await db.select().from(variations).where(and(eq(variations.id, variationId), eq(variations.userId, userId))).limit(1))[0];
}

export async function updateVariationStatusForUser(variationId: number, userId: number, status: "draft" | "sent" | "approved" | "declined") {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(variations).set({ status, sentAt: status === "sent" ? new Date() : undefined, respondedAt: status === "approved" || status === "declined" ? new Date() : undefined, updatedAt: new Date() }).where(and(eq(variations.id, variationId), eq(variations.userId, userId)));
  return (await db.select().from(variations).where(and(eq(variations.id, variationId), eq(variations.userId, userId))).limit(1))[0];
}

export async function createPaymentRequestForUser(jobId: number, userId: number, payload: PaymentRequestPayload) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const job = (await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1))[0];
  if (!job) return undefined;
  const created = await db.insert(paymentRequests).values({
    jobId,
    userId,
    paymentNumber: `${payload.kind === "deposit" ? "DEP" : "INV"}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
    kind: payload.kind,
    title: payload.title,
    description: payload.description ?? null,
    requestedAmountCents: payload.requestedAmountCents,
    dueDate: payload.dueDate ?? null,
  }).$returningId();
  const id = Number(created[0]?.id);
  return (await db.select().from(paymentRequests).where(and(eq(paymentRequests.id, id), eq(paymentRequests.userId, userId))).limit(1))[0];
}

export async function setPaymentCheckoutSessionForUser(paymentRequestId: number, userId: number, sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(paymentRequests).set({ stripeCheckoutSessionId: sessionId, updatedAt: new Date() }).where(and(eq(paymentRequests.id, paymentRequestId), eq(paymentRequests.userId, userId)));
  return (await db.select().from(paymentRequests).where(and(eq(paymentRequests.id, paymentRequestId), eq(paymentRequests.userId, userId))).limit(1))[0];
}

export async function getPaymentRequestsForJob(jobId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.select().from(paymentRequests).where(and(eq(paymentRequests.jobId, jobId), eq(paymentRequests.userId, userId))).orderBy(desc(paymentRequests.updatedAt));
}

export async function getFieldDashboardSummaryForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [pendingApprovals, sentVariations] = await Promise.all([
    db.select().from(quoteAcceptances).where(and(eq(quoteAcceptances.userId, userId), eq(quoteAcceptances.status, "pending"))),
    db.select().from(variations).where(and(eq(variations.userId, userId), eq(variations.status, "sent"))),
  ]);
  return { pendingApprovals: pendingApprovals.length, sentVariations: sentVariations.length };
}
