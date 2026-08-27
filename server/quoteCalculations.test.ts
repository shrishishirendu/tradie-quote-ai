import { describe, expect, it } from "vitest";
import { calculateQuoteTotals, lineTotalCents } from "./quoteCalculations";

describe("quote calculations", () => {
  it("applies markup to a line before calculating totals", () => {
    expect(lineTotalCents({ quantity: 2, rate: 125, markupPercent: 10 })).toBe(27500);
  });

  it("calculates GST from the combined rounded subtotal", () => {
    const totals = calculateQuoteTotals([
      { quantity: 1.5, rate: 80, markupPercent: 0 },
      { quantity: 2, rate: 37.25, markupPercent: 20 },
    ]);

    expect(totals).toEqual({ subtotalCents: 20940, gstCents: 2094, totalCents: 23034 });
  });

  it("guards totals from invalid or negative inputs", () => {
    const totals = calculateQuoteTotals([
      { quantity: -2, rate: 100, markupPercent: 0 },
      { quantity: 1, rate: Number.NaN, markupPercent: 0 },
    ], -10);

    expect(totals).toEqual({ subtotalCents: 0, gstCents: 0, totalCents: 0 });
  });
});
