import { describe, expect, it } from "vitest";
import { calculateQuoteJobTotal } from "./jobSnapshot";

describe("quote-to-job snapshot total", () => {
  it("carries the GST-inclusive accepted quote total into the new job", () => {
    const total = calculateQuoteJobTotal([
      { quantity: "1.5", rate: "120.00", markupPercent: "0" },
      { quantity: "2", rate: "37.25", markupPercent: "20" },
    ], "10.00");
    expect(total).toBe(296.34);
  });
});
