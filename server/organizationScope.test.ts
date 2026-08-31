import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("organization-scoped business access", () => {
  it("does not use direct userId predicates for organization-owned business tables", () => {
    for (const table of ["quotes", "jobs", "priceBookItems", "variations", "paymentRequests", "quoteAcceptances"]) {
      expect(dbSource).not.toMatch(new RegExp(`eq\\(${table}\\.userId\\s*,`));
    }
  });

  it("uses organization predicates in every user-facing business helper", () => {
    const helpers = [
      "getQuotesForUser",
      "getQuoteDetailForUser",
      "createQuoteForUser",
      "updateQuoteForUser",
      "duplicateQuoteForUser",
      "getPriceBookItemsForUser",
      "createPriceBookItemForUser",
      "updatePriceBookItemForUser",
      "batchImportPriceBookForUser",
      "getJobsForUser",
      "createJobFromQuoteForUser",
      "updateJobStatusForUser",
      "createQuoteAcceptanceForUser",
      "getVariationsForJob",
      "createVariationForUser",
      "updateVariationStatusForUser",
      "createPaymentRequestForUser",
      "setPaymentCheckoutSessionForUser",
      "getPaymentRequestsForJob",
      "getFieldDashboardSummaryForUser",
    ];

    for (const helper of helpers) {
      const start = dbSource.indexOf(`export async function ${helper}`);
      expect(start, `${helper} should exist`).toBeGreaterThanOrEqual(0);
      const next = dbSource.indexOf("export async function ", start + 1);
      const body = dbSource.slice(start, next === -1 ? dbSource.length : next);
      expect(body, `${helper} should use organization context`).toMatch(/getOrganizationForUser|upsertOrganizationForUser|organizationId|getQuoteDetailForUser|createQuoteForUser/);
    }
  });
});
