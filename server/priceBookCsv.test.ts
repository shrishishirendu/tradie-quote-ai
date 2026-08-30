import { describe, expect, it } from "vitest";
import { parsePriceBookCsv, priceBookCsvTemplate } from "../shared/priceBookCsv";

describe("priceBookCsv", () => {
  it("parses quoted cells and validates rows", () => {
    const rows = parsePriceBookCsv('name,description,category,trade,unit,rate,markupPercent\n"Mixer, kitchen","Supply and fit",materials,Plumbing,each,120,25\nBad,,,Plumbing,each,nope,700', []);
    expect(rows[0]).toMatchObject({ name: "Mixer, kitchen", category: "materials", rate: 120, markupPercent: 25, errors: [] });
    expect(rows[1]?.errors).toEqual(expect.arrayContaining(["Description is required", "Category is required", "Rate must be a non-negative number", "Markup must be a number from -100 to 500"]));
  });

  it("detects active duplicates by name and trade only", () => {
    const rows = parsePriceBookCsv('name,description,category,trade,unit,rate,markupPercent\nService call,Call,callout, Plumbing ,job,95,20\nService call,Call,callout,Electrical,job,95,20', [{ id: 4, name: "service call", trade: "Plumbing", status: "active" }, { id: 5, name: "Service call", trade: "Electrical", status: "archived" }]);
    expect(rows[0]?.duplicateId).toBe(4);
    expect(rows[1]?.duplicateId).toBeUndefined();
  });

  it("provides the required import template headers", () => {
    expect(priceBookCsvTemplate().split("\n")[0]).toBe("name,description,category,trade,unit,rate,markupPercent");
  });
});
