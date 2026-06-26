import type { CardEmi, Expense, Goal, Income, Loan } from "./db";
import { computeLoanState, calcEMI, emiDueDate, emiDueYm } from "./finance";
import { ymCompare, ymOf, ymAdd } from "./format";

/** Determines if a recurring item with start `startYm` and count `months` is active in `targetYm`. */
function recurringActive(startYm: string, months: number | null | undefined, targetYm: string): boolean {
  if (ymCompare(startYm, targetYm) > 0) return false;
  if (months == null) return true;
  // active for [startYm, startYm + months - 1]
  const endYm = ymAdd(startYm, months - 1);
  return ymCompare(targetYm, endYm) <= 0;
}

export function incomeForMonth(items: Income[], ym: string): { item: Income; amount: number; effectiveDate: string }[] {
  const result: { item: Income; amount: number; effectiveDate: string }[] = [];
  for (const it of items) {
    const itYm = ymOf(it.date);
    if (it.recurrence === "one_time") {
      if (itYm === ym) result.push({ item: it, amount: it.amount, effectiveDate: it.date });
    } else {
      if (recurringActive(itYm, it.months ?? null, ym)) {
        // anchor day from start date
        const day = new Date(it.date).getDate();
        const [y, m] = ym.split("-").map(Number);
        const d = new Date(y, m - 1, day);
        result.push({ item: it, amount: it.amount, effectiveDate: d.toISOString() });
      }
    }
  }
  return result;
}

export function manualExpensesForMonth(items: Expense[], ym: string): { item: Expense; amount: number; effectiveDate: string }[] {
  const result: { item: Expense; amount: number; effectiveDate: string }[] = [];
  for (const it of items) {
    const itYm = ymOf(it.date);
    if (it.recurrence === "one_time") {
      if (itYm === ym) result.push({ item: it, amount: it.amount, effectiveDate: it.date });
    } else {
      if (recurringActive(itYm, it.months ?? null, ym)) {
        const day = new Date(it.date).getDate();
        const [y, m] = ym.split("-").map(Number);
        const d = new Date(y, m - 1, day);
        result.push({ item: it, amount: it.amount, effectiveDate: d.toISOString() });
      }
    }
  }
  return result;
}

export function loanEmisForMonth(loans: Loan[], ym: string): { loan: Loan; amount: number; effectiveDate: string }[] {
  const out: { loan: Loan; amount: number; effectiveDate: string }[] = [];
  for (const l of loans) {
    for (let i = 0; i < l.tenureMonths; i++) {
      if (emiDueYm(l.startDate, i) !== ym) continue;
      const due = emiDueDate(l.startDate, i);
      out.push({
        loan: l,
        amount: calcEMI(l.principal, l.annualRatePct, l.tenureMonths),
        effectiveDate: due.toISOString(),
      });
      break;
    }
  }
  return out;
}

export function cardEmisForMonth(cards: CardEmi[], ym: string): { card: CardEmi; amount: number; effectiveDate: string }[] {
  const out: { card: CardEmi; amount: number; effectiveDate: string }[] = [];
  for (const c of cards) {
    for (let i = 0; i < c.tenureMonths; i++) {
      if (emiDueYm(c.startDate, i) !== ym) continue;
      const due = emiDueDate(c.startDate, i);
      out.push({ card: c, amount: c.emiAmount, effectiveDate: due.toISOString() });
      break;
    }
  }
  return out;
}

export interface MonthlySummary {
  ym: string;
  income: number;
  manualExpenses: number;
  loanEmiTotal: number;
  cardEmiTotal: number;
  totalExpenses: number;
  recurringBills: number;
  monthlyCommitments: number;
  netSavings: number;
  expensesByCategory: Record<string, number>;
  outstanding: number;
  remainingInterest: number;
}

export function summarizeMonth(
  ym: string,
  income: Income[],
  expenses: Expense[],
  loans: Loan[],
  cards: CardEmi[],
): MonthlySummary {
  const inc = incomeForMonth(income, ym).reduce((s, x) => s + x.amount, 0);
  const manual = manualExpensesForMonth(expenses, ym);
  const manualTotal = manual.reduce((s, x) => s + x.amount, 0);
  const loanEmis = loanEmisForMonth(loans, ym);
  const cardEmis = cardEmisForMonth(cards, ym);
  const loanEmiTotal = loanEmis.reduce((s, x) => s + x.amount, 0);
  const cardEmiTotal = cardEmis.reduce((s, x) => s + x.amount, 0);
  const totalExpenses = manualTotal + loanEmiTotal + cardEmiTotal;

  // recurring bills = monthly expenses (manual) that are recurring
  const recurringBills = manual
    .filter((x) => x.item.recurrence === "monthly")
    .reduce((s, x) => s + x.amount, 0);

  const monthlyCommitments = loanEmiTotal + cardEmiTotal + recurringBills;

  const expensesByCategory: Record<string, number> = {};
  for (const m of manual) {
    expensesByCategory[m.item.category] = (expensesByCategory[m.item.category] ?? 0) + m.amount;
  }
  if (loanEmiTotal > 0) expensesByCategory["Loan EMI"] = (expensesByCategory["Loan EMI"] ?? 0) + loanEmiTotal;
  if (cardEmiTotal > 0) expensesByCategory["Card EMI"] = (expensesByCategory["Card EMI"] ?? 0) + cardEmiTotal;

  // Loan totals up to this month
  let outstanding = 0;
  let remainingInterest = 0;
  for (const l of loans) {
    const s = computeLoanState(l.principal, l.annualRatePct, l.tenureMonths, l.startDate, ym);
    outstanding += s.outstanding;
    remainingInterest += s.remainingInterest;
  }

  return {
    ym,
    income: inc,
    manualExpenses: manualTotal,
    loanEmiTotal,
    cardEmiTotal,
    totalExpenses,
    recurringBills,
    monthlyCommitments,
    netSavings: inc - totalExpenses,
    expensesByCategory,
    outstanding,
    remainingInterest,
  };
}

export function goalProgress(g: Goal): { pct: number; remaining: number } {
  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
  return { pct, remaining: Math.max(0, g.targetAmount - g.currentAmount) };
}

export type ChartRangeFilter =
  | "selected_month"
  | "last_3"
  | "last_6"
  | "last_12"
  | "current_year"
  | "all_time";

function collectActivityMonths(
  income: Income[],
  expenses: Expense[],
  loans: Loan[],
  cards: CardEmi[],
  endYm: string,
): string[] {
  const yms = new Set<string>();

  const addRecurring = (startIso: string, recurrence: string, count: number | null | undefined) => {
    const start = ymOf(startIso);
    if (recurrence === "one_time") {
      if (ymCompare(start, endYm) <= 0) yms.add(start);
      return;
    }
    const n = count ?? 600;
    for (let i = 0; i < n; i++) {
      const m = ymAdd(start, i);
      if (ymCompare(m, endYm) > 0) break;
      yms.add(m);
    }
  };

  for (const it of income) addRecurring(it.date, it.recurrence, it.months);
  for (const it of expenses) addRecurring(it.date, it.recurrence, it.months);
  for (const l of loans) {
    for (let i = 0; i < l.tenureMonths; i++) {
      const m = emiDueYm(l.startDate, i);
      if (ymCompare(m, endYm) > 0) break;
      yms.add(m);
    }
  }
  for (const c of cards) {
    for (let i = 0; i < c.tenureMonths; i++) {
      const m = emiDueYm(c.startDate, i);
      if (ymCompare(m, endYm) > 0) break;
      yms.add(m);
    }
  }

  return [...yms].sort();
}

export function monthsForChartFilter(
  filter: ChartRangeFilter,
  selectedYm: string,
  income: Income[],
  expenses: Expense[],
  loans: Loan[],
  cards: CardEmi[],
): string[] {
  switch (filter) {
    case "selected_month":
      return [selectedYm];
    case "last_3":
      return Array.from({ length: 3 }, (_, i) => ymAdd(selectedYm, -2 + i));
    case "last_6":
      return Array.from({ length: 6 }, (_, i) => ymAdd(selectedYm, -5 + i));
    case "last_12":
      return Array.from({ length: 12 }, (_, i) => ymAdd(selectedYm, -11 + i));
    case "current_year": {
      const year = selectedYm.split("-")[0];
      return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
    }
    case "all_time":
      return collectActivityMonths(income, expenses, loans, cards, selectedYm);
  }
}

export function aggregatedExpensesByCategory(
  months: string[],
  income: Income[],
  expenses: Expense[],
  loans: Loan[],
  cards: CardEmi[],
): { categories: Record<string, number>; totalExpenses: number } {
  const categories: Record<string, number> = {};
  let totalExpenses = 0;
  for (const m of months) {
    const s = summarizeMonth(m, income, expenses, loans, cards);
    totalExpenses += s.totalExpenses;
    for (const [k, v] of Object.entries(s.expensesByCategory)) {
      categories[k] = (categories[k] ?? 0) + v;
    }
  }
  return { categories, totalExpenses };
}
