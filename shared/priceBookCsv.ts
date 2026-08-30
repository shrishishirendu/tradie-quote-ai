export type PriceBookCsvCategory = "labour" | "materials" | "callout" | "equipment" | "other";
export type PriceBookImportDecision = "create" | "update" | "skip";
export const PRICE_BOOK_CSV_HEADERS = ["name", "description", "category", "trade", "unit", "rate", "markupPercent"] as const;
export type PriceBookCsvExistingItem = { id: number; name: string; trade: string; status: "active" | "archived" };
export type PriceBookCsvRow = { rowNumber: number; name: string; description: string; category: PriceBookCsvCategory | ""; trade: string; unit: string; rate: number; markupPercent: number; errors: string[]; duplicateId?: number; decision: PriceBookImportDecision };

const categories = new Set<PriceBookCsvCategory>(["labour", "materials", "callout", "equipment", "other"]);
const clean = (value: string | undefined) => (value ?? "").trim();
const keyFor = (name: string, trade: string) => `${name.toLocaleLowerCase()}\u0000${trade.toLocaleLowerCase()}`;

export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) { const char = source[i]; const next = source[i + 1];
    if (char === '"') { if (quoted && next === '"') { cell += '"'; i += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") i += 1; row.push(cell); cell = ""; if (row.some(value => value.trim())) rows.push(row); row = []; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some(value => value.trim())) rows.push(row); }
  return rows;
}

export function escapeCsvCell(value: string | number) { const text = String(value); return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function priceBookCsvTemplate() { return `${PRICE_BOOK_CSV_HEADERS.join(",")}\nStandard service call,Initial attendance and diagnosis,callout,Plumbing,job,95,20\n`; }

export function parsePriceBookCsv(text: string, existingItems: PriceBookCsvExistingItem[]): PriceBookCsvRow[] {
  const records = parseCsvRecords(text); if (!records.length) return [];
  const header = records[0].map(clean); const indexes = Object.fromEntries(PRICE_BOOK_CSV_HEADERS.map(column => [column, header.indexOf(column)])) as Record<typeof PRICE_BOOK_CSV_HEADERS[number], number>;
  const missingHeaders = PRICE_BOOK_CSV_HEADERS.filter(column => indexes[column] < 0);
  return records.slice(1).map((record, offset) => {
    const rowNumber = offset + 2; const name = clean(record[indexes.name]); const description = clean(record[indexes.description]); const rawCategory = clean(record[indexes.category]).toLowerCase(); const category = categories.has(rawCategory as PriceBookCsvCategory) ? rawCategory as PriceBookCsvCategory : ""; const trade = clean(record[indexes.trade]); const unit = clean(record[indexes.unit]); const rawRate = clean(record[indexes.rate]); const rawMarkup = clean(record[indexes.markupPercent]); const rate = Number(rawRate); const markupPercent = Number(rawMarkup || "0");
    const errors: string[] = missingHeaders.map(column => `Missing column: ${column}`); if (!name) errors.push("Name is required"); if (!description) errors.push("Description is required"); if (!category) errors.push(rawCategory ? `Invalid category: ${rawCategory}` : "Category is required"); if (!trade) errors.push("Trade is required"); if (!unit) errors.push("Unit is required"); if (!rawRate || !Number.isFinite(rate) || rate < 0) errors.push("Rate must be a non-negative number"); if (!Number.isFinite(markupPercent) || markupPercent < -100 || markupPercent > 500) errors.push("Markup must be a number from -100 to 500");
    const duplicate = name && trade ? existingItems.find(item => item.status === "active" && keyFor(item.name.trim(), item.trade.trim()) === keyFor(name, trade)) : undefined;
    return { rowNumber, name, description, category, trade, unit, rate, markupPercent, errors, duplicateId: duplicate?.id, decision: "create" };
  });
}

export type PriceBookImportRow = Omit<PriceBookCsvRow, "rowNumber" | "errors" | "duplicateId"> & { duplicateId?: number };
export function toImportPayload(row: PriceBookCsvRow): PriceBookImportRow { return { name: row.name, description: row.description, category: row.category as PriceBookCsvCategory, trade: row.trade, unit: row.unit, rate: row.rate, markupPercent: row.markupPercent, decision: row.decision, duplicateId: row.duplicateId }; }
