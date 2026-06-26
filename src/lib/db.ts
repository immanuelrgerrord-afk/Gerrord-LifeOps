import { openDB, type IDBPDatabase, type DBSchema } from "idb";

export type Recurrence = "one_time" | "monthly";

export interface Income {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string; // ISO start date
  recurrence: Recurrence;
  months?: number | null; // for monthly: how many months; null = forever
  createdAt: string;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  recurrence: Recurrence;
  months?: number | null;
  createdAt: string;
}

export type LoanType = "personal" | "home" | "car" | "education" | "gold" | "business";

export interface Loan {
  id: string;
  name: string;
  bank: string;
  type: LoanType;
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  startDate: string;
  createdAt: string;
}

export interface CardEmi {
  id: string;
  merchant: string;
  purchaseAmount: number;
  emiAmount: number;
  annualRatePct?: number;
  tenureMonths: number;
  startDate: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: "income" | "expense";
  builtin?: boolean;
}

export interface Settings {
  id: "app";
  theme: "system" | "light" | "dark";
  userName?: string;
}

interface FinanceDB extends DBSchema {
  income: { key: string; value: Income };
  expense: { key: string; value: Expense };
  loan: { key: string; value: Loan };
  cardemi: { key: string; value: CardEmi };
  goal: { key: string; value: Goal };
  category: { key: string; value: Category };
  settings: { key: string; value: Settings };
}

const DB_NAME = "lifeops-finance";
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase<FinanceDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<FinanceDB>> {
  if (typeof window === "undefined") return Promise.reject(new Error("DB only available in browser"));
  if (!_db) {
    _db = openDB<FinanceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("income")) db.createObjectStore("income", { keyPath: "id" });
        if (!db.objectStoreNames.contains("expense")) db.createObjectStore("expense", { keyPath: "id" });
        if (!db.objectStoreNames.contains("loan")) db.createObjectStore("loan", { keyPath: "id" });
        if (!db.objectStoreNames.contains("cardemi")) db.createObjectStore("cardemi", { keyPath: "id" });
        if (!db.objectStoreNames.contains("goal")) db.createObjectStore("goal", { keyPath: "id" });
        if (!db.objectStoreNames.contains("category")) db.createObjectStore("category", { keyPath: "id" });
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
      },
    }).then(async (db) => {
      // Seed default categories if empty
      const tx = db.transaction("category", "readwrite");
      const count = await tx.store.count();
      if (count === 0) {
        for (const c of DEFAULT_CATEGORIES) await tx.store.put(c);
      }
      await tx.done;
      return db;
    });
  }
  return _db;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Food", color: "tangerine", icon: "Utensils" },
  { name: "Fuel", color: "rose", icon: "Fuel" },
  { name: "Shopping", color: "violet", icon: "ShoppingBag" },
  { name: "Bills", color: "royal", icon: "Receipt" },
  { name: "Utilities", color: "royal", icon: "Plug" },
  { name: "Groceries", color: "emerald", icon: "ShoppingCart" },
  { name: "Entertainment", color: "violet", icon: "Clapperboard" },
  { name: "Travel", color: "royal", icon: "Plane" },
  { name: "Insurance", color: "emerald", icon: "Shield" },
  { name: "Health", color: "rose", icon: "Heart" },
  { name: "Rent", color: "gold", icon: "Home" },
  { name: "Investment", color: "emerald", icon: "TrendingUp" },
  { name: "Loan EMI", color: "rose", icon: "Landmark" },
  { name: "Card EMI", color: "violet", icon: "CreditCard" },
  { name: "Other", color: "tangerine", icon: "Sparkles" },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: "Salary", color: "emerald", icon: "Wallet" },
  { name: "Bonus", color: "gold", icon: "Gift" },
  { name: "Freelance", color: "royal", icon: "Briefcase" },
  { name: "Interest", color: "violet", icon: "PiggyBank" },
  { name: "Other", color: "tangerine", icon: "Sparkles" },
];

const DEFAULT_CATEGORIES: Category[] = [
  ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ id: `exp-${c.name.toLowerCase().replace(/\s+/g, "-")}`, kind: "expense" as const, builtin: true, ...c })),
  ...DEFAULT_INCOME_CATEGORIES.map((c) => ({ id: `inc-${c.name.toLowerCase().replace(/\s+/g, "-")}`, kind: "income" as const, builtin: true, ...c })),
];

export async function exportAll(): Promise<string> {
  const db = await getDb();
  const data: Record<string, unknown[]> = {};
  for (const store of ["income", "expense", "loan", "cardemi", "goal", "category", "settings"] as const) {
    data[store] = await db.getAll(store);
  }
  return JSON.stringify({ version: DB_VERSION, exportedAt: new Date().toISOString(), data }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const parsed = JSON.parse(json) as { data: Record<string, unknown[]> };
  const db = await getDb();
  for (const store of ["income", "expense", "loan", "cardemi", "goal", "category", "settings"] as const) {
    const tx = db.transaction(store, "readwrite");
    await tx.store.clear();
    for (const row of (parsed.data[store] ?? []) as never[]) {
      await tx.store.put(row);
    }
    await tx.done;
  }
}

export async function resetAll(): Promise<void> {
  const db = await getDb();
  for (const store of ["income", "expense", "loan", "cardemi", "goal", "category"] as const) {
    const tx = db.transaction(store, "readwrite");
    await tx.store.clear();
    await tx.done;
  }
}
