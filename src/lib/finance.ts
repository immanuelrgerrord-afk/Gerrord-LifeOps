import { ymAdd, ymOf } from "./format";

/** Calendar due date for installment index (0-based) anchored to start date's day-of-month. */
export function emiDueDate(startDateIso: string, installmentIndex: number): Date {
  const start = new Date(startDateIso);
  return new Date(start.getFullYear(), start.getMonth() + installmentIndex, start.getDate());
}

/** Reference date for loan/EMI status as of a selected month (capped at today). */
export function asOfDateForYm(ym: string, now = new Date()): Date {
  const [y, m] = ym.split("-").map(Number);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  return today.getTime() < endOfMonth.getTime() ? today : endOfMonth;
}

function isEmiDueOnOrBefore(startDateIso: string, installmentIndex: number, asOf: Date): boolean {
  const due = emiDueDate(startDateIso, installmentIndex);
  due.setHours(23, 59, 59, 999);
  return due.getTime() <= asOf.getTime();
}

export function emiDueYm(startDateIso: string, installmentIndex: number): string {
  const d = emiDueDate(startDateIso, installmentIndex);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** EMIs whose due date is on or before asOf. */
export function emisPaidCount(startDateIso: string, tenureMonths: number, asOf: Date): number {
  let count = 0;
  for (let i = 0; i < tenureMonths; i++) {
    if (isEmiDueOnOrBefore(startDateIso, i, asOf)) count++;
    else break;
  }
  return count;
}

export function calcEMI(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return emi;
}

/**
 * Build amortization schedule.
 * Returns months array with principal/interest/balance.
 */
export interface AmortRow {
  monthIndex: number; // 0-based from start
  ym: string;
  emi: number;
  interest: number;
  principal: number;
  balance: number;
}

export function buildSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  startDateIso: string,
): AmortRow[] {
  const r = annualRatePct / 12 / 100;
  const emi = calcEMI(principal, annualRatePct, months);
  const rows: AmortRow[] = [];
  let balance = principal;
  const startYm = ymOf(startDateIso);
  for (let i = 0; i < months; i++) {
    const interest = balance * r;
    const princ = Math.min(balance, emi - interest);
    balance = Math.max(0, balance - princ);
    rows.push({
      monthIndex: i,
      ym: ymAdd(startYm, i),
      emi,
      interest,
      principal: princ,
      balance,
    });
  }
  return rows;
}

export interface LoanState {
  outstanding: number;
  totalPaid: number;
  principalPaid: number;
  remainingInterest: number;
  totalInterest: number;
  monthsPaid: number;
  monthsRemaining: number;
  nextEmiDate: string | null;
  endDate: string;
  emi: number;
  completionPct: number;
}

export function computeLoanState(
  principal: number,
  annualRatePct: number,
  months: number,
  startDateIso: string,
  upToYm: string,
): LoanState {
  const schedule = buildSchedule(principal, annualRatePct, months, startDateIso);
  const emi = schedule[0]?.emi ?? 0;
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const asOf = asOfDateForYm(upToYm);
  const paidRows = schedule.filter((r) => isEmiDueOnOrBefore(startDateIso, r.monthIndex, asOf));
  const monthsPaid = paidRows.length;
  const monthsRemaining = Math.max(0, months - monthsPaid);
  const totalPaid = paidRows.reduce((s, r) => s + r.emi, 0);
  const principalPaid = paidRows.reduce((s, r) => s + r.principal, 0);
  const interestPaid = paidRows.reduce((s, r) => s + r.interest, 0);
  const remainingInterest = Math.max(0, totalInterest - interestPaid);
  const outstanding = paidRows.length > 0 ? paidRows[paidRows.length - 1].balance : principal;
  const nextRow = schedule.find((r) => !isEmiDueOnOrBefore(startDateIso, r.monthIndex, asOf));
  return {
    outstanding,
    totalPaid,
    principalPaid,
    remainingInterest,
    totalInterest,
    monthsPaid,
    monthsRemaining,
    nextEmiDate: nextRow ? emiDueDate(startDateIso, nextRow.monthIndex).toISOString() : null,
    endDate: emiDueDate(startDateIso, months - 1).toISOString(),
    emi,
    completionPct: months > 0 ? (monthsPaid / months) * 100 : 0,
  };
}

export interface CardEmiState {
  monthsPaid: number;
  monthsRemaining: number;
  totalPaid: number;
  remainingAmount: number;
  nextEmiDate: string | null;
  endDate: string;
}

export function computeCardEmiState(
  startDateIso: string,
  tenureMonths: number,
  emiAmount: number,
  upToYm: string,
): CardEmiState {
  const asOf = asOfDateForYm(upToYm);
  const monthsPaid = emisPaidCount(startDateIso, tenureMonths, asOf);
  const monthsRemaining = Math.max(0, tenureMonths - monthsPaid);
  return {
    monthsPaid,
    monthsRemaining,
    totalPaid: monthsPaid * emiAmount,
    remainingAmount: monthsRemaining * emiAmount,
    nextEmiDate: monthsPaid < tenureMonths ? emiDueDate(startDateIso, monthsPaid).toISOString() : null,
    endDate: emiDueDate(startDateIso, tenureMonths - 1).toISOString(),
  };
}

/**
 * Prepayment simulation for home loan.
 * extraMonthly: additional amount each month
 * lumpSumAmount + lumpSumYm: one-time payment in a given month (applied at end of month, after EMI)
 */
export interface PrepayResult {
  baselineMonths: number;
  baselineTotalInterest: number;
  newMonths: number;
  newTotalInterest: number;
  monthsSaved: number;
  interestSaved: number;
  newEndYm: string;
  newEndDate: string;
}

export function simulatePrepayment(
  principal: number,
  annualRatePct: number,
  months: number,
  startDateIso: string,
  fromYm: string,
  extraMonthly: number,
  lumpSum: { amount: number; ym: string } | null,
): PrepayResult {
  const baseline = buildSchedule(principal, annualRatePct, months, startDateIso);
  const baselineTotalInterest = baseline.reduce((s, r) => s + r.interest, 0);
  const r = annualRatePct / 12 / 100;
  const emi = baseline[0]?.emi ?? 0;
  const fromAsOf = asOfDateForYm(fromYm);
  let balance = principal;
  let i = 0;
  let lumpApplied = false;

  const applyLump = (installmentIndex: number, bal: number): number => {
    if (lumpApplied || !lumpSum || lumpSum.amount <= 0) return bal;
    if (emiDueYm(startDateIso, installmentIndex) !== lumpSum.ym) return bal;
    lumpApplied = true;
    return Math.max(0, bal - Math.min(bal, lumpSum.amount));
  };

  for (; i < baseline.length; i++) {
    if (!isEmiDueOnOrBefore(startDateIso, i, fromAsOf)) break;
    const interest = balance * r;
    const princ = Math.min(balance, emi - interest);
    balance = Math.max(0, balance - princ);
    balance = applyLump(i, balance);
  }

  let m = i;
  let totalInterestPaidInFuture = 0;
  let lastDueIndex = Math.max(0, i - 1);
  while (balance > 0.5 && m < 12 * 100) {
    const dueIndex = i < baseline.length ? i : lastDueIndex + 1;
    if (i < baseline.length) lastDueIndex = i;
    else lastDueIndex = dueIndex;
    const interest = balance * r;
    const payment = emi + extraMonthly;
    let princ = Math.min(balance, Math.max(0, payment - interest));
    balance = Math.max(0, balance - princ);
    balance = applyLump(i < baseline.length ? i : dueIndex, balance);
    totalInterestPaidInFuture += interest;
    m++;
    i++;
  }

  const interestBefore = baseline
    .filter((row) => isEmiDueOnOrBefore(startDateIso, row.monthIndex, fromAsOf))
    .reduce((s, row) => s + row.interest, 0);
  const newTotalInterest = interestBefore + totalInterestPaidInFuture;
  const newMonths = m;
  const newEndDate = emiDueDate(startDateIso, Math.max(0, lastDueIndex)).toISOString();
  return {
    baselineMonths: months,
    baselineTotalInterest,
    newMonths,
    newTotalInterest,
    monthsSaved: Math.max(0, months - newMonths),
    interestSaved: Math.max(0, baselineTotalInterest - newTotalInterest),
    newEndYm: emiDueYm(startDateIso, Math.max(0, lastDueIndex)),
    newEndDate,
  };
}
