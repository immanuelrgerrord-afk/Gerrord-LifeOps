import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  PiggyBank,
  Landmark,
  Sparkles,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { MonthSwitcher } from "@/components/month-switcher";
import { GlassCard } from "@/components/glass-card";
import { useStore } from "@/lib/store";
import { summarizeMonth, goalProgress, monthsForChartFilter, aggregatedExpensesByCategory, type ChartRangeFilter } from "@/lib/aggregate";
import { formatINR, formatMonthShort, ymAdd, formatPercent } from "@/lib/format";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — LifeOps" },
      { name: "description", content: "Your monthly money snapshot — income, expenses, savings, loans and goals at a glance." },
    ],
  }),
  component: Dashboard,
});

const CATEGORY_COLORS = ["var(--emerald)", "var(--royal)", "var(--tangerine)", "var(--violet)", "var(--gold)", "var(--rose)"];

const CHART_FILTER_OPTIONS: { value: ChartRangeFilter; label: string }[] = [
  { value: "selected_month", label: "Selected Month" },
  { value: "last_3", label: "Last 3 Months" },
  { value: "last_6", label: "Last 6 Months" },
  { value: "last_12", label: "Last 12 Months" },
  { value: "current_year", label: "Current Year" },
  { value: "all_time", label: "All Time" },
];

function Dashboard() {
  const { data, ym, ready, userName } = useStore();
  const [barFilter, setBarFilter] = useState<ChartRangeFilter>("last_6");
  const [pieFilter, setPieFilter] = useState<ChartRangeFilter>("last_6");

  const summary = useMemo(
    () => summarizeMonth(ym, data.income, data.expense, data.loan, data.cardemi),
    [ym, data],
  );

  const trend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const m = ymAdd(ym, -5 + i);
      const s = summarizeMonth(m, data.income, data.expense, data.loan, data.cardemi);
      return {
        ym: m,
        label: formatMonthShort(m),
        income: Math.round(s.income),
        expenses: Math.round(s.totalExpenses),
        savings: Math.round(s.netSavings),
        outstanding: Math.round(s.outstanding),
      };
    });
  }, [ym, data]);

  const barTrend = useMemo(() => {
    const months = monthsForChartFilter(barFilter, ym, data.income, data.expense, data.loan, data.cardemi);
    return months.map((m) => {
      const s = summarizeMonth(m, data.income, data.expense, data.loan, data.cardemi);
      return {
        ym: m,
        label: formatMonthShort(m),
        income: Math.round(s.income),
        expenses: Math.round(s.totalExpenses),
      };
    });
  }, [barFilter, ym, data]);

  const { catData, catTotalExpenses } = useMemo(() => {
    const months = monthsForChartFilter(pieFilter, ym, data.income, data.expense, data.loan, data.cardemi);
    const { categories, totalExpenses } = aggregatedExpensesByCategory(
      months, data.income, data.expense, data.loan, data.cardemi,
    );
    const catData = Object.entries(categories)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
    return { catData, catTotalExpenses: totalExpenses };
  }, [pieFilter, ym, data]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    return userName ? `${base}, ${userName} 👋` : base;
  }, [userName]);

  if (!ready) return <PageShell title="LifeOps">{null}</PageShell>;

  return (
    <PageShell
      title={greeting}
      subtitle={userName ? "Welcome back — here's your money this month" : "Here's your money this month"}
      right={
        <Link to="/settings" className="grid h-10 w-10 place-items-center rounded-full glass">
          <SettingsIcon className="h-4.5 w-4.5" />
        </Link>
      }
    >
      <div className="mb-4">
        <MonthSwitcher />
      </div>

      {/* Hero balance card */}
      <GlassCard variant="aurora" className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">Net savings this month</p>
            <p className="mt-1 text-4xl font-black tabular tracking-tight">
              {formatINR(summary.netSavings)}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              {summary.income > 0
                ? `${formatPercent((summary.netSavings / summary.income) * 100, 0)} of income`
                : "Add income to start tracking"}
            </div>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <PiggyBank className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <div className="flex items-center gap-1.5 text-white/80">
              <ArrowDownRight className="h-3.5 w-3.5" /> Income
            </div>
            <div className="mt-1 text-lg font-bold tabular">{formatINR(summary.income)}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <div className="flex items-center gap-1.5 text-white/80">
              <ArrowUpRight className="h-3.5 w-3.5" /> Spent
            </div>
            <div className="mt-1 text-lg font-bold tabular">{formatINR(summary.totalExpenses)}</div>
          </div>
        </div>
      </GlassCard>

      {/* Quick stats */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatTile
          label="Commitments"
          value={formatINR(summary.monthlyCommitments)}
          sub="EMIs + bills"
          icon={<Receipt className="h-4 w-4" />}
          tint="royal"
        />
        <StatTile
          label="Loan outstanding"
          value={formatINR(summary.outstanding)}
          sub={`${formatINR(summary.remainingInterest)} interest left`}
          icon={<Landmark className="h-4 w-4" />}
          tint="rose"
        />
      </div>

      {/* Loan payable summary */}
      {data.loan.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile label="Outstanding" value={formatINR(summary.outstanding)} sub="Principal" icon={<Landmark className="h-4 w-4" />} tint="royal" />
          <StatTile label="Interest left" value={formatINR(summary.remainingInterest)} sub="To be paid" icon={<Receipt className="h-4 w-4" />} tint="violet" />
          <StatTile label="Total payable" value={formatINR(summary.outstanding + summary.remainingInterest)} sub="Principal + interest" icon={<PiggyBank className="h-4 w-4" />} tint="rose" />
        </div>
      )}

      {/* Income vs Expense chart */}
      <SectionTitle
        title="Income vs Expenses"
        right={<ChartRangeSelect value={barFilter} onChange={setBarFilter} />}
      />
      <GlassCard className="p-3">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barTrend} barCategoryGap={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => formatINR(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              <Bar dataKey="income" fill="var(--emerald)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="var(--rose)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Category breakdown */}
      {catData.length > 0 && (
        <>
          <SectionTitle
            title="Where it went"
            right={
              <div className="flex items-center gap-2">
                <ChartRangeSelect value={pieFilter} onChange={setPieFilter} />
                <Link to="/transactions" className="text-xs font-medium text-primary">View all</Link>
              </div>
            }
          />
          <GlassCard className="p-4">
            <div className="grid grid-cols-[140px_1fr] items-center gap-2">
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={catData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="none">
                      {catData.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {catData.slice(0, 5).map((c, i) => {
                  const pct = catTotalExpenses > 0 ? (c.value / catTotalExpenses) * 100 : 0;
                  return (
                    <li key={c.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                      <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                      <span className="tabular text-muted-foreground">{formatPercent(pct, 0)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </GlassCard>
        </>
      )}

      {/* Savings trend */}
      <SectionTitle title="Savings trend" />
      <GlassCard className="p-3">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="sav" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--emerald)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--emerald)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis hide />
              <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="savings" stroke="var(--emerald)" strokeWidth={2.5} fill="url(#sav)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Goals progress */}
      {data.goal.length > 0 && (
        <>
          <SectionTitle title="Goals" right={<Link to="/goals" className="text-xs font-medium text-primary">Manage</Link>} />
          <div className="space-y-2">
            {data.goal.slice(0, 3).map((g) => {
              const { pct } = goalProgress(g);
              return (
                <GlassCard key={g.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground tabular">
                        {formatINR(g.currentAmount)} / {formatINR(g.targetAmount)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-1 text-xs font-bold tabular text-primary">
                      {formatPercent(pct, 0)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald to-royal transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {/* Loan trend if any loans */}
      {data.loan.length > 0 && (
        <>
          <SectionTitle title="Loan outstanding" right={<Link to="/loans" className="text-xs font-medium text-primary">Loans</Link>} />
          <GlassCard className="p-3">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--rose)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--rose)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis hide />
                  <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="outstanding" stroke="var(--rose)" strokeWidth={2.5} fill="url(#out)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </>
      )}

      {/* Empty hint */}
      {data.income.length === 0 && data.expense.length === 0 && data.loan.length === 0 && (
        <div className="mt-6">
          <GlassCard variant="emerald" className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Welcome to LifeOps</p>
                <p className="mt-1 text-sm text-white/80">
                  Start by adding your monthly salary, a few expenses, and any loans. Everything updates automatically each month.
                </p>
                <Link
                  to="/transactions"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur"
                >
                  <Plus className="h-4 w-4" /> Add your first entry
                </Link>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </PageShell>
  );
}

function ChartRangeSelect({
  value,
  onChange,
}: {
  value: ChartRangeFilter;
  onChange: (v: ChartRangeFilter) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ChartRangeFilter)}
      className="glass h-8 rounded-full border-0 bg-transparent px-2.5 text-[11px] font-semibold text-muted-foreground outline-none"
      aria-label="Chart time range"
    >
      {CHART_FILTER_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {right}
    </div>
  );
}

function StatTile({
  label, value, sub, icon, tint,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode; tint: "royal" | "emerald" | "rose" | "violet" | "gold";
}) {
  const tints: Record<string, string> = {
    royal: "from-royal/25 to-royal/5 text-royal",
    emerald: "from-emerald/25 to-emerald/5 text-emerald",
    rose: "from-rose/25 to-rose/5 text-rose",
    violet: "from-violet/25 to-violet/5 text-violet",
    gold: "from-gold/25 to-gold/5 text-gold",
  };
  return (
    <div className="glass rounded-3xl p-4">
      <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${tints[tint]}`}>{icon}</div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
