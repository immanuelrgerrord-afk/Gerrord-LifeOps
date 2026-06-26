import { appConfig } from "./env";

const inrFormatter = new Intl.NumberFormat(appConfig.defaultLocale, {
  style: "currency",
  currency: appConfig.defaultCurrency,
  maximumFractionDigits: 0,
});

const inrDecimal = new Intl.NumberFormat(appConfig.defaultLocale, {
  style: "currency",
  currency: appConfig.defaultCurrency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberIN = new Intl.NumberFormat(appConfig.defaultLocale, { maximumFractionDigits: 0 });

export function formatINR(value: number, opts?: { decimals?: boolean }): string {
  if (!Number.isFinite(value)) return "₹0";
  if (opts?.decimals) return inrDecimal.format(value);
  return inrFormatter.format(Math.round(value));
}

export function formatINRSigned(value: number): string {
  const sign = value < 0 ? "-" : "";
  return sign + formatINR(Math.abs(value));
}

export function formatNumberIN(value: number): string {
  return numberIN.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

export function formatMonthLabel(ym: string): string {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(appConfig.defaultLocale, { month: "long", year: "numeric" });
}

export function formatMonthShort(ym: string, day = 1): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(appConfig.defaultLocale, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(appConfig.defaultLocale, { day: "numeric", month: "short", year: "numeric" });
}

export function ymOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ymAdd(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ymRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => ymAdd(start, i));
}

export function ymCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function ymToDate(ym: string, day = 1): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, day);
}
