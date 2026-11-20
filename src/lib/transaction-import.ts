export type TransactionKind = "income" | "expense";

export interface ImportCandidate {
  title: string;
  amount: number;
  date: string;
  kind: TransactionKind;
  category: string;
  recurrence: "one_time" | "monthly";
  months: number | null;
  duplicate: boolean;
  sourceLine: number;
}

export interface ExistingTransaction {
  title: string;
  amount: number;
  date: string;
  kind: TransactionKind;
}

export interface CategoryOption {
  name: string;
  kind: TransactionKind;
}
export type LearnedCategories = Record<string, string>;

const LEARN_KEY = "lifeops:merchant-categories:v1";

export function readLearnedCategories(): LearnedCategories {
  try {
    const value = JSON.parse(localStorage.getItem(LEARN_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function rememberCategory(title: string, kind: TransactionKind, category: string): void {
  const learned = readLearnedCategories();
  learned[`${kind}:${normalize(title)}`] = category;
  localStorage.setItem(LEARN_KEY, JSON.stringify(learned));
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function categoryFor(
  title: string,
  kind: TransactionKind,
  categories: CategoryOption[],
  learned: LearnedCategories,
): string {
  const names = categories.filter((c) => c.kind === kind).map((c) => c.name);
  const learnedName = learned[`${kind}:${normalize(title)}`];
  if (learnedName && names.includes(learnedName)) return learnedName;
  const text = normalize(title);
  const rules: Array<[RegExp, string]> =
    kind === "income"
      ? [
          [/salary|payroll/, "Salary"],
          [/bonus|incentive/, "Bonus"],
          [/freelance|client|consult/, "Freelance"],
          [/interest|dividend/, "Interest"],
        ]
      : [
          [/\b(?:rd|ppf)\b|post office|recurring deposit|mutual fund|investment/, "Investment"],
          [
            /momo|dinner|lunch|breakfast|food|restaurant|zomato|swiggy|kfc|grill|chew|cafe|coffee|tea|snack|juice/,
            "Food",
          ],
          [/grocery|vegetable|supermarket|grocer/, "Groceries"],
          [/fuel|petrol|diesel|gas station/, "Fuel"],
          [/uber|ola|taxi|flight|train|bus|travel/, "Travel"],
          [/window|rod|home|furniture|appliance|dress|amazon|dashcam|sd card|camera/, "Shopping"],
          [
            /electric|water bill|water purifier|drainage|plumb|internet|mobile recharge|utility/,
            "Utilities",
          ],
          [
            /bill|subscription|insurance|google drive|g drive|credit card|cc payment|hdfc card/,
            "Bills",
          ],
        ];
  const match = rules.find(([pattern, category]) => pattern.test(text) && names.includes(category));
  return match?.[1] ?? (names.includes("Other") ? "Other" : (names[0] ?? ""));
}

function parseDate(value: string | undefined, defaultDate: string): string {
  if (!value?.trim()) return defaultDate;
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  if (dmy)
    return `${dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? defaultDate : parsed.toISOString().slice(0, 10);
}

function sameTransaction(a: ExistingTransaction, b: ImportCandidate): boolean {
  return (
    a.kind === b.kind &&
    Math.abs(a.amount - b.amount) < 0.005 &&
    normalize(a.title) === normalize(b.title) &&
    a.date.slice(0, 10) === b.date.slice(0, 10)
  );
}

/** Parses simple pasted lists and common CSV exports without making network calls. */
export function parseTransactionText(
  input: string,
  options: {
    defaultDate: string;
    categories: CategoryOption[];
    existing?: ExistingTransaction[];
    learned?: LearnedCategories;
  },
): { rows: ImportCandidate[]; errors: string[] } {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const rows: ImportCandidate[] = [];
  const errors: string[] = [];
  let monthYear: string | null = null;
  const monthNames =
    "january february march april may june july august september october november december".split(
      " ",
    );
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || /^\s*(#|\/\/)/.test(raw)) continue;
    const header = raw.match(
      /^(?:(?:expenses?|transactions?)\s+)?([a-z]+)(?:\s+expenses?)?(?:\s+(20\d{2}))?(?:\s+expenses?)?$/i,
    );
    if (header && monthNames.includes(header[1].toLowerCase())) {
      const year = header[2] ?? options.defaultDate.slice(0, 4);
      monthYear = `${year}-${String(monthNames.indexOf(header[1].toLowerCase()) + 1).padStart(2, "0")}`;
      continue;
    }
    if (/^(date|description|title|merchant)[,\t;]/i.test(raw)) continue;
    const isMonthly = /\b(?:per\s+month|monthly)\b/i.test(raw);
    const durationYears = raw.match(/\b(\d+)\s+years?\b/i);
    const durationMonths = raw.match(/\b(\d+)\s+months?\b/i);
    const line = raw.replace(/\s+(?:per\s+month|monthly)\s*$/i, "");
    let title = "",
      amountText = "",
      dateText: string | undefined;
    if (line.includes(",") || line.includes("\t") || line.includes(";")) {
      const fields = line.split(/[,\t;]/).map((s) => s.trim().replace(/^"|"$/g, ""));
      const numberAt = fields.findIndex((field) =>
        /^[-+]?\s*₹?\s*\d[\d,]*(?:\.\d{1,2})?$/.test(field),
      );
      if (numberAt >= 0) {
        amountText = fields[numberAt];
        const dateAt = fields.findIndex((field) =>
          /^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(field),
        );
        dateText = dateAt >= 0 ? fields[dateAt] : undefined;
        title = fields
          .filter((_, index) => index !== numberAt && index !== dateAt)
          .join(" ")
          .trim();
      }
    }
    if (!amountText) {
      const match = line.match(
        /^(.*?)(?:\s*[-–—:]\s*|\s+)(?:₹\s*)?([+-]?\s*\d[\d,]*(?:\.\d{1,2})?)\s*$/,
      );
      if (match) {
        title = match[1].trim();
        amountText = match[2];
      }
    }
    const amount = Number(amountText.replace(/[₹,\s]/g, ""));
    if (!title || !Number.isFinite(amount) || amount === 0) {
      errors.push(`Line ${i + 1}: couldn’t read a description and non-zero amount.`);
      continue;
    }
    const isIncome =
      /^(received|income|salary|credited|refund)\b/i.test(title) ||
      /\b(?:refund|return(?:ed)?)\b/i.test(title) ||
      amount < 0;
    const kind: TransactionKind = isIncome ? "income" : "expense";
    const cleanTitle =
      title.replace(/^(received|income|salary|credited|refund)\s*[-:–—]?\s*/i, "") || title;
    const date = parseDate(dateText, monthYear ? `${monthYear}-01` : options.defaultDate);
    const row: ImportCandidate = {
      title: cleanTitle,
      amount: Math.abs(amount),
      date,
      kind,
      category: categoryFor(cleanTitle || title, kind, options.categories, options.learned ?? {}),
      recurrence: isMonthly ? "monthly" : "one_time",
      months: isMonthly
        ? durationMonths
          ? Number(durationMonths[1])
          : durationYears
            ? Number(durationYears[1]) * 12
            : null
        : null,
      duplicate: (options.existing ?? []).some((item) =>
        sameTransaction(item, { title: cleanTitle, amount: Math.abs(amount), date, kind }),
      ),
      sourceLine: i + 1,
    };
    rows.push(row);
  }
  // Also flag duplicates within this import batch.
  rows.forEach((row, index) => {
    if (rows.slice(0, index).some((other) => sameTransaction(other, row))) row.duplicate = true;
  });
  return { rows, errors };
}
