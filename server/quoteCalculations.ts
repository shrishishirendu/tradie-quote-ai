export type CalculationLine = {
  quantity: number;
  rate: number;
  markupPercent: number;
};

export type QuoteTotals = {
  subtotalCents: number;
  gstCents: number;
  totalCents: number;
};

const finiteNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

export function lineTotalCents(line: CalculationLine): number {
  const quantity = Math.max(0, finiteNumber(line.quantity));
  const rate = Math.max(0, finiteNumber(line.rate));
  const markupPercent = Math.max(-100, finiteNumber(line.markupPercent));
  const baseCents = Math.round(quantity * rate * 100);
  return Math.round(baseCents * (1 + markupPercent / 100));
}

export function calculateQuoteTotals(
  lines: CalculationLine[],
  gstRate = 10
): QuoteTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + lineTotalCents(line),
    0
  );
  const normalizedGstRate = Math.max(0, finiteNumber(gstRate));
  const gstCents = Math.round(subtotalCents * (normalizedGstRate / 100));
  return { subtotalCents, gstCents, totalCents: subtotalCents + gstCents };
}

export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
