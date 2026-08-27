export type PriceBookQuoteSource = {
  category: "labour" | "materials" | "callout" | "equipment" | "other";
  name: string;
  description?: string | null;
  unit: string;
  rate: number | string;
  markupPercent: number | string;
};

export function applyPriceBookItemToQuote(item: PriceBookQuoteSource, sortOrder: number) {
  return {
    category: item.category,
    description: item.description?.trim() || item.name,
    unit: item.unit,
    quantity: 1,
    rate: Number(item.rate),
    markupPercent: Number(item.markupPercent),
    sortOrder,
  };
}
