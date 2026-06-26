import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Repeat, ArrowDownRight, ArrowUpRight, Pencil } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { MonthSwitcher } from "@/components/month-switcher";
import { GlassCard } from "@/components/glass-card";
import { EmptyState } from "@/components/empty-state";
import { TransactionSheet } from "@/components/transaction-sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { incomeForMonth, manualExpensesForMonth, loanEmisForMonth, cardEmisForMonth, summarizeMonth } from "@/lib/aggregate";
import { formatINR, formatDate } from "@/lib/format";
import { getDb, type Income, type Expense } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Money — LifeOps" },
      { name: "description", content: "Track every rupee in and out — income, expenses, EMIs and recurring bills." },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { data, ym, refresh } = useStore();
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Income | Expense | null>(null);

  const summary = useMemo(
    () => summarizeMonth(ym, data.income, data.expense, data.loan, data.cardemi),
    [ym, data],
  );

  const incomeItems = useMemo(
    () => incomeForMonth(data.income, ym).sort((a, b) => a.effectiveDate < b.effectiveDate ? 1 : -1),
    [data.income, ym],
  );
  const manualExpenseItems = useMemo(
    () => manualExpensesForMonth(data.expense, ym).sort((a, b) => a.effectiveDate < b.effectiveDate ? 1 : -1),
    [data.expense, ym],
  );
  const loanEmis = useMemo(() => loanEmisForMonth(data.loan, ym), [data.loan, ym]);
  const cardEmis = useMemo(() => cardEmisForMonth(data.cardemi, ym), [data.cardemi, ym]);

  async function remove(kind: "income" | "expense", id: string) {
    if (!confirm("Delete this entry?")) return;
    const db = await getDb();
    await db.delete(kind, id);
    await refresh();
    toast.success("Deleted");
  }

  const chips = useMemo(() => {
    const incomeMonthly = incomeItems.filter(i => i.item.recurrence === "monthly").length;
    const incomeOneTime = incomeItems.filter(i => i.item.recurrence === "one_time").length;
    const expenseMonthly = manualExpenseItems.filter(i => i.item.recurrence === "monthly").length;
    const expenseOneTime = manualExpenseItems.filter(i => i.item.recurrence === "one_time").length;
    return { incomeMonthly, incomeOneTime, expenseMonthly, expenseOneTime, loanEmi: loanEmis.length, cardEmi: cardEmis.length };
  }, [incomeItems, manualExpenseItems, loanEmis, cardEmis]);

  return (
    <PageShell title="Money" subtitle="What flowed in and out">
      <div className="mb-3"><MonthSwitcher /></div>

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Income" value={formatINR(summary.income)} accent="emerald" />
        <MiniStat label="Spent" value={formatINR(summary.totalExpenses)} accent="rose" />
        <MiniStat label="Net" value={formatINR(summary.netSavings)} accent={summary.netSavings >= 0 ? "royal" : "rose"} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip tint="emerald" label={`Income · Monthly ${chips.incomeMonthly}`} />
        <Chip tint="emerald" label={`Income · One-time ${chips.incomeOneTime}`} />
        <Chip tint="rose" label={`Expenses · Monthly ${chips.expenseMonthly}`} />
        <Chip tint="rose" label={`Expenses · One-time ${chips.expenseOneTime}`} />
        <Chip tint="royal" label={`Auto Loan EMI ${chips.loanEmi}`} />
        <Chip tint="violet" label={`Auto Card EMI ${chips.cardEmi}`} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as never)} className="mt-4">
        <TabsList className="glass grid h-12 w-full grid-cols-2 rounded-2xl p-1">
          <TabsTrigger value="expense" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-rose/30 data-[state=active]:to-rose/10 data-[state=active]:text-foreground">
            <ArrowUpRight className="mr-1.5 h-4 w-4" /> Expenses
          </TabsTrigger>
          <TabsTrigger value="income" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald/30 data-[state=active]:to-emerald/10 data-[state=active]:text-foreground">
            <ArrowDownRight className="mr-1.5 h-4 w-4" /> Income
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-4 space-y-2">
          {loanEmis.length === 0 && cardEmis.length === 0 && manualExpenseItems.length === 0 ? (
            <EmptyState
              icon={<ArrowUpRight className="h-6 w-6" />}
              title="No expenses this month"
              description="Tap + to add your first expense."
            />
          ) : (
            <>
              {loanEmis.map((e) => (
                <Row
                  key={`loan-${e.loan.id}`}
                  title={e.loan.name}
                  sub={`${e.loan.bank} • Loan EMI`}
                  amount={-e.amount}
                  date={e.effectiveDate}
                  badge={<AutoBadge label="Auto" />}
                />
              ))}
              {cardEmis.map((e) => (
                <Row
                  key={`card-${e.card.id}`}
                  title={e.card.merchant}
                  sub="Credit card EMI"
                  amount={-e.amount}
                  date={e.effectiveDate}
                  badge={<AutoBadge label="Auto" />}
                />
              ))}
              {manualExpenseItems.map((e) => (
                <Row
                  key={`exp-${e.item.id}-${e.effectiveDate}`}
                  title={e.item.title}
                  sub={e.item.category}
                  amount={-e.amount}
                  date={e.effectiveDate}
                  badge={e.item.recurrence === "monthly" ? <AutoBadge label="Monthly" icon /> : undefined}
                  onEdit={() => { setEditing(e.item); setSheetOpen(true); }}
                  onDelete={() => remove("expense", e.item.id)}
                />
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="income" className="mt-4 space-y-2">
          {incomeItems.length === 0 ? (
            <EmptyState
              icon={<ArrowDownRight className="h-6 w-6" />}
              title="No income this month"
              description="Add your salary or other income sources."
            />
          ) : (
            incomeItems.map((e) => (
              <Row
                key={`inc-${e.item.id}-${e.effectiveDate}`}
                title={e.item.title}
                sub={e.item.category}
                amount={+e.amount}
                date={e.effectiveDate}
                badge={e.item.recurrence === "monthly" ? <AutoBadge label="Monthly" icon /> : undefined}
                onEdit={() => { setEditing(e.item); setSheetOpen(true); }}
                onDelete={() => remove("income", e.item.id)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <Fab onClick={() => { setEditing(null); setSheetOpen(true); }} />

      <TransactionSheet
        open={sheetOpen}
        onOpenChange={(o) => { setSheetOpen(o); if (!o) setEditing(null); }}
        kind={tab}
        editing={editing}
      />
    </PageShell>
  );
}

function Chip({ label, tint }: { label: string; tint: "emerald" | "rose" | "royal" | "violet" }) {
  const tints = {
    emerald: "bg-emerald/15 text-emerald",
    rose: "bg-rose/15 text-rose",
    royal: "bg-royal/15 text-royal",
    violet: "bg-violet/15 text-violet",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${tints[tint]}`}>{label}</span>;
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: "emerald" | "rose" | "royal" }) {
  const tints = {
    emerald: "from-emerald/20 to-emerald/5",
    rose: "from-rose/20 to-rose/5",
    royal: "from-royal/20 to-royal/5",
  };
  return (
    <div className={`glass rounded-2xl bg-gradient-to-br ${tints[accent]} p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold tabular tracking-tight">{value}</p>
    </div>
  );
}

function AutoBadge({ label, icon }: { label: string; icon?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
      {icon && <Repeat className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

function Row({
  title, sub, amount, date, badge, onEdit, onDelete,
}: {
  title: string; sub: string; amount: number; date: string; badge?: React.ReactNode;
  onEdit?: () => void; onDelete?: () => void;
}) {
  const negative = amount < 0;
  return (
    <GlassCard className="px-3 py-3">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{title}</p>
            {badge}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {sub} · {formatDate(date)}
          </p>
        </div>
        <div className="text-right">
          <p className={`tabular text-sm font-bold ${negative ? "text-rose" : "text-emerald"}`}>
            {negative ? "−" : "+"}{formatINR(Math.abs(amount))}
          </p>
          {(onEdit || onDelete) && (
            <div className="mt-1 flex justify-end gap-1">
              {onEdit && (
                <button onClick={onEdit} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-rose/15 hover:text-rose">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-1/2 z-30 grid h-14 w-14 translate-x-[calc(50%+min(50vw-32px,192px))] place-items-center rounded-full gradient-emerald text-white shadow-glow transition-transform active:scale-95"
      aria-label="Add transaction"
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </button>
  );
}
