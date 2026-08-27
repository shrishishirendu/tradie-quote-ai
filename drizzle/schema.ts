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

export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  quoteNumber: varchar("quoteNumber", { length: 48 }).notNull(),
  status: mysqlEnum("status", ["draft", "ready", "sent"]).default("draft").notNull(),
  businessName: varchar("businessName", { length: 160 }),
  businessAbn: varchar("businessAbn", { length: 32 }),
  businessLicence: varchar("businessLicence", { length: 80 }),
  businessPhone: varchar("businessPhone", { length: 48 }),
  businessEmail: varchar("businessEmail", { length: 320 }),
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
}, table => [index("quotes_user_updated_idx").on(table.userId, table.updatedAt)]);

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type QuotePhoto = typeof quotePhotos.$inferSelect;
