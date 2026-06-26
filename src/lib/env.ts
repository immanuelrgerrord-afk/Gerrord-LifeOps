export type AppTheme = "system" | "light" | "dark";

function parseTheme(value: string | undefined): AppTheme {
  if (value === "light" || value === "dark" || value === "system") return value;
  if (value === "auto") return "system";
  return "system";
}

export const appConfig = {
  name: import.meta.env.VITE_APP_NAME ?? "LifeOps",
  version: import.meta.env.VITE_APP_VERSION ?? "1.0.0",
  defaultTheme: parseTheme(import.meta.env.VITE_DEFAULT_THEME),
  defaultCurrency: import.meta.env.VITE_DEFAULT_CURRENCY ?? "INR",
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE ?? "en-IN",
  apiUrl: import.meta.env.VITE_API_URL ?? "",
} as const;
