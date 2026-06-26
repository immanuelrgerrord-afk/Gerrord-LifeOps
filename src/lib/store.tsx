import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { getDb, type CardEmi, type Category, type Expense, type Goal, type Income, type Loan } from "./db";
import { appConfig } from "./env";
import { currentYm } from "./format";

interface AllData {
  income: Income[];
  expense: Expense[];
  loan: Loan[];
  cardemi: CardEmi[];
  goal: Goal[];
  category: Category[];
}

interface Ctx {
  ready: boolean;
  data: AllData;
  ym: string;
  setYm: (ym: string) => void;
  refresh: () => Promise<void>;
  theme: "system" | "light" | "dark";
  setTheme: (t: "system" | "light" | "dark") => void;
  userName: string;
  setUserName: (n: string) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

const EMPTY: AllData = { income: [], expense: [], loan: [], cardemi: [], goal: [], category: [] };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AllData>(EMPTY);
  const [ym, setYm] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lifeops:ym") ?? currentYm();
    }
    return currentYm();
  });
  const [theme, setThemeState] = useState<"system" | "light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lifeops:theme") as "system" | "light" | "dark") ?? appConfig.defaultTheme;
    }
    return appConfig.defaultTheme;
  });
  const [userName, setUserNameState] = useState<string>("");

  const refresh = useCallback(async () => {
    const db = await getDb();
    const [income, expense, loan, cardemi, goal, category, settings] = await Promise.all([
      db.getAll("income"),
      db.getAll("expense"),
      db.getAll("loan"),
      db.getAll("cardemi"),
      db.getAll("goal"),
      db.getAll("category"),
      db.get("settings", "app"),
    ]);
    setData({ income, expense, loan, cardemi, goal, category });
    if (settings?.userName) setUserNameState(settings.userName);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("lifeops:ym", ym);
  }, [ym]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("lifeops:theme", theme);
    const root = document.documentElement;
    const applyTheme = () => {
      const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", isDark ? "#0d1020" : "#f7f7f5");
    };
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => theme === "system" && applyTheme();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: "system" | "light" | "dark") => setThemeState(t), []);

  const setUserName = useCallback(async (n: string) => {
    setUserNameState(n);
    const db = await getDb();
    await db.put("settings", { id: "app", theme, userName: n });
  }, [theme]);

  return (
    <StoreCtx.Provider value={{ ready, data, ym, setYm, refresh, theme, setTheme, userName, setUserName }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
