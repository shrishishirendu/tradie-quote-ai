import { calculateQuoteTotals } from "./quoteCalculations";

export type QuoteLineForJob = {
  quantity: number | string;
  rate: number | string;
  markupPercent: number | string;
};

export function calculateQuoteJobTotal(lines: QuoteLineForJob[], gstRate: number | string) {
  const totals = calculateQuoteTotals(lines.map(item => ({
    quantity: Number(item.quantity),
    rate: Number(item.rate),
    markupPercent: Number(item.markupPercent),
  })), Number(gstRate));
  return totals.totalCents / 100;
}
