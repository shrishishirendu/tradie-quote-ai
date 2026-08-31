import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  ownerUserId: int("ownerUserId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  abn: varchar("abn", { length: 32 }),
  licence: varchar("licence", { length: 80 }),
  phone: varchar("phone", { length: 48 }),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  quoteNumber: varchar("quoteNumber", { length: 48 }).notNull(),
  status: mysqlEnum("status", ["draft", "ready", "sent"]).default("draft").notNull(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 48 }),
  trade: varchar("trade", { length: 100 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 220 }).notNull(),
  jobAddress: text("jobAddress"),
  siteDetails: text("siteDetails"),
  scopeOfWork: text("scopeOfWork"),
  assumptions: text("assumptions"),
  exclusions: text("exclusions"),
  terms: text("terms"),
  gstRate: decimal("gstRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("quotes_user_updated_idx").on(table.userId, table.updatedAt), index("quotes_organization_updated_idx").on(table.organizationId, table.updatedAt)]);

export const quoteLineItems = mysqlTable("quoteLineItems", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  category: mysqlEnum("category", ["labour", "materials", "callout", "equipment", "other"]).notNull(),
  description: varchar("description", { length: 320 }).notNull(),
  unit: varchar("unit", { length: 32 }).default("each").notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  rate: decimal("rate", { precision: 12, scale: 2 }).notNull(),
  markupPercent: decimal("markupPercent", { precision: 7, scale: 2 }).default("0.00").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
}, table => [index("quote_line_items_quote_idx").on(table.quoteId, table.sortOrder)]);

export const quotePhotos = mysqlTable("quotePhotos", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  url: varchar("url", { length: 720 }).notNull(),
  fileName: varchar("fileName", { length: 220 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("quote_photos_quote_idx").on(table.quoteId)]);

export const priceBookItems = mysqlTable("priceBookItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: mysqlEnum("category", ["labour", "materials", "callout", "equipment", "other"]).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 32 }).default("each").notNull(),
  rate: decimal("rate", { precision: 12, scale: 2 }).notNull(),
  markupPercent: decimal("markupPercent", { precision: 7, scale: 2 }).default("0.00").notNull(),
  trade: varchar("trade", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("price_book_user_status_idx").on(table.userId, table.status, table.trade)]);

export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceQuoteId: int("sourceQuoteId").references(() => quotes.id, { onDelete: "set null" }),
  jobNumber: varchar("jobNumber", { length: 48 }).notNull(),
  status: mysqlEnum("status", ["planned", "active", "on_hold", "complete"]).default("planned").notNull(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  trade: varchar("trade", { length: 100 }).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  address: text("address"),
  scopeOfWork: text("scopeOfWork"),
  quotedTotal: decimal("quotedTotal", { precision: 14, scale: 2 }).notNull(),
  gstRate: decimal("gstRate", { precision: 5, scale: 2 }).default("10.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("jobs_user_status_updated_idx").on(table.userId, table.status, table.updatedAt), index("jobs_source_quote_idx").on(table.sourceQuoteId)]);

export const quoteAcceptances = mysqlTable("quoteAcceptances", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  publicToken: varchar("publicToken", { length: 96 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "declined", "revoked"]).default("pending").notNull(),
  recipientName: varchar("recipientName", { length: 160 }),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  quoteSnapshot: text("quoteSnapshot").notNull(),
  snapshotHash: varchar("snapshotHash", { length: 64 }).notNull(),
  acceptedName: varchar("acceptedName", { length: 160 }),
  acceptedEmail: varchar("acceptedEmail", { length: 320 }),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("quote_acceptances_user_quote_idx").on(table.userId, table.quoteId), index("quote_acceptances_quote_status_idx").on(table.quoteId, table.status)]);

export const variations = mysqlTable("variations", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  variationNumber: varchar("variationNumber", { length: 48 }).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  reason: text("reason"),
  scopeOfWork: text("scopeOfWork").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "approved", "declined"]).default("draft").notNull(),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull(),
  gstAmount: decimal("gstAmount", { precision: 14, scale: 2 }).notNull(),
  total: decimal("total", { precision: 14, scale: 2 }).notNull(),
  customerResponse: text("customerResponse"),
  sentAt: timestamp("sentAt"),
  respondedAt: timestamp("respondedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("variations_job_status_idx").on(table.jobId, table.status, table.updatedAt), index("variations_user_updated_idx").on(table.userId, table.updatedAt)]);

export const variationPhotos = mysqlTable("variationPhotos", {
  id: int("id").autoincrement().primaryKey(),
  variationId: int("variationId").notNull().references(() => variations.id, { onDelete: "cascade" }),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  url: varchar("url", { length: 720 }).notNull(),
  fileName: varchar("fileName", { length: 220 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("variation_photos_variation_idx").on(table.variationId)]);

export const paymentRequests = mysqlTable("paymentRequests", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  paymentNumber: varchar("paymentNumber", { length: 48 }).notNull(),
  kind: mysqlEnum("kind", ["deposit", "invoice"]).notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description"),
  requestedAmountCents: int("requestedAmountCents").notNull(),
  dueDate: timestamp("dueDate"),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("payment_requests_job_updated_idx").on(table.jobId, table.updatedAt), index("payment_requests_session_idx").on(table.stripeCheckoutSessionId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type QuotePhoto = typeof quotePhotos.$inferSelect;
export type PriceBookItem = typeof priceBookItems.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type QuoteAcceptance = typeof quoteAcceptances.$inferSelect;
export type Variation = typeof variations.$inferSelect;
export type VariationPhoto = typeof variationPhotos.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
