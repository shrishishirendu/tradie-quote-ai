import { describe, expect, it } from "vitest";
import { applyPriceBookItemToQuote } from "../shared/priceBook";

describe("price book quote snapshots", () => {
  it("copies the current price-book values into an independently editable quote line", () => {
    const source = { category: "materials" as const, name: "Vanity mixer", description: "Supply chrome basin mixer", unit: "each", rate: "245.00", markupPercent: "15.00" };
    const quoteLine = applyPriceBookItemToQuote(source, 3);

    expect(quoteLine).toEqual({ category: "materials", description: "Supply chrome basin mixer", unit: "each", quantity: 1, rate: 245, markupPercent: 15, sortOrder: 3 });
    source.description = "A later master-item edit";
    source.rate = "299.00";
    expect(quoteLine.description).toBe("Supply chrome basin mixer");
    expect(quoteLine.rate).toBe(245);
  });

  it("uses the item name when there is no customer description", () => {
    expect(applyPriceBookItemToQuote({ category: "callout", name: "Standard service call", unit: "each", rate: 165, markupPercent: 0 }, 0).description).toBe("Standard service call");
  });
});
