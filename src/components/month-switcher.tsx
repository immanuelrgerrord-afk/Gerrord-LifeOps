import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useStore } from "@/lib/store";
import { formatMonthLabel, ymAdd, currentYm } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function MonthSwitcher({ compact = false }: { compact?: boolean }) {
  const { ym, setYm } = useStore();
  const isCurrent = ym === currentYm();
  return (
    <div className="glass flex items-center justify-between gap-1 rounded-full p-1">
      <button
        onClick={() => setYm(ymAdd(ym, -1))}
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => setYm(currentYm())}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold tracking-tight"
      >
        <Calendar className="h-4 w-4 text-primary" />
        <span>{compact ? formatMonthLabel(ym).split(" ")[0] : formatMonthLabel(ym)}</span>
        {!isCurrent && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Today
          </span>
        )}
      </button>
      <button
        onClick={() => setYm(ymAdd(ym, 1))}
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
