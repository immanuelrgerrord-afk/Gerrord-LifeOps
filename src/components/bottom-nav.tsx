import { Link, useLocation } from "@tanstack/react-router";
import { Home, ListPlus, Landmark, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/transactions", icon: ListPlus, label: "Money" },
  { to: "/loans", icon: Landmark, label: "Loans" },
  { to: "/goals", icon: Target, label: "Goals" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="glass-strong pointer-events-auto flex w-full max-w-md items-center justify-around rounded-3xl px-2 py-2">
        {items.map(({ to, icon: Icon, label }) => {
          const active =
            to === "/"
              ? pathname === "/"
              : pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition-all",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {active && (
                <span className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/30" />
              )}
              <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
