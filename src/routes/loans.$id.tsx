import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Calculator } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GlassCard } from "@/components/glass-card";
import { useStore } from "@/lib/store";
import { buildSchedule, computeLoanState, simulatePrepayment, emiDueDate } from "@/lib/finance";
import { formatINR, formatMonthLabel, formatPercent, currentYm, formatDate, ymAdd } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/loans/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Loan ${params.id} — LifeOps` },
      { name: "description", content: "Loan details, schedule and prepayment simulator." },
    ],
  }),
  component: LoanDetail,
});

function LoanDetail() {
  const { id } = Route.useParams();
  const { data, ym } = useStore();
  const navigate = useNavigate();
  const loan = data.loan.find(l => l.id === id);

  const [extra, setExtra] = useState("");
  const [lump, setLump] = useState("");
  const [lumpYm, setLumpYm] = useState(currentYm());

  const state = useMemo(
    () => loan ? computeLoanState(loan.principal, loan.annualRatePct, loan.tenureMonths, loan.startDate, ym) : null,
    [loan, ym],
  );

  const schedule = useMemo(
    () => loan ? buildSchedule(loan.principal, loan.annualRatePct, loan.tenureMonths, loan.startDate) : [],
    [loan],
  );

  const chartData = useMemo(
    () => {
      if (!loan) return [];
      return schedule.filter((_, i) => i % Math.max(1, Math.floor(schedule.length / 24)) === 0)
        .map(r => ({ label: formatDate(emiDueDate(loan.startDate, r.monthIndex).toISOString()), balance: Math.round(r.balance) }));
    },
    [schedule, loan],
  );

  const sim = useMemo(() => {
    if (!loan) return null;
    const e = Number(extra), l = Number(lump);
    const hasExtra = Number.isFinite(e) && e > 0;
    const hasLump = Number.isFinite(l) && l > 0;
    if (!hasExtra && !hasLump) return null;
    return simulatePrepayment(
      loan.principal, loan.annualRatePct, loan.tenureMonths, loan.startDate,
      currentYm(),
      hasExtra ? e : 0,
      hasLump ? { amount: l, ym: lumpYm } : null,
    );
  }, [loan, extra, lump, lumpYm]);

  if (!loan || !state) {
    return (
      <PageShell title="Not found">
        <p className="text-sm text-muted-foreground">Loan doesn't exist.</p>
        <Link to="/loans" className="mt-3 inline-block text-primary">Back to loans</Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={loan.name}
      subtitle={`${loan.bank} · ${loan.type[0].toUpperCase() + loan.type.slice(1)} loan`}
      right={
        <button onClick={() => navigate({ to: "/loans" })} className="grid h-10 w-10 place-items-center rounded-full glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
      }
    >
      <GlassCard variant="royal" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Outstanding</p>
        <p className="mt-1 text-3xl font-black tabular tracking-tight">{formatINR(state.outstanding)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${state.completionPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-white/80">
          <span>{formatPercent(state.completionPct, 1)} paid</span>
          <span>{state.monthsRemaining} months left</span>
        </div>
      </GlassCard>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile label="EMI" value={formatINR(state.emi)} />
        <Tile label="Rate" value={formatPercent(loan.annualRatePct, 2)} />
        <Tile label="Tenure" value={`${loan.tenureMonths} mo`} />
        <Tile label="End date" value={formatDate(state.endDate)} />
        <Tile label="Total interest" value={formatINR(state.totalInterest)} />
        <Tile label="Interest left" value={formatINR(state.remainingInterest)} />
        <Tile label="Total paid" value={formatINR(state.totalPaid)} />
        <Tile label="Next EMI" value={state.nextEmiDate ? formatDate(state.nextEmiDate) : "Done"} />
      </div>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">Outstanding over time</h2>
      <GlassCard className="p-3">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--royal)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--royal)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
              <YAxis hide />
              <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="balance" stroke="var(--royal)" strokeWidth={2.5} fill="url(#bal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {loan.type === "home" && (
        <>
          <h2 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Calculator className="h-4 w-4" /> Prepayment simulator
          </h2>
          <GlassCard className="space-y-3 p-4">
            <p className="text-xs text-muted-foreground">Calculator only — nothing is saved.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="extra">Extra monthly (₹)</Label>
                <Input id="extra" type="number" inputMode="decimal" value={extra} onChange={e => setExtra(e.target.value)} placeholder="5000" />
              </div>
              <div>
                <Label htmlFor="lump">One-time lump sum (₹)</Label>
                <Input id="lump" type="number" inputMode="decimal" value={lump} onChange={e => setLump(e.target.value)} placeholder="100000" />
              </div>
            </div>
            {Number(lump) > 0 && (
              <div>
                <Label htmlFor="lumpYm">Lump-sum month</Label>
                <select
                  id="lumpYm"
                  value={lumpYm}
                  onChange={e => setLumpYm(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Array.from({ length: 36 }, (_, i) => ymAdd(currentYm(), i)).map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
            )}
            {sim && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <ResultTile label="Months saved" value={`${sim.monthsSaved}`} tint="emerald" />
                <ResultTile label="Interest saved" value={formatINR(sim.interestSaved)} tint="emerald" />
                <ResultTile label="New end date" value={formatDate(sim.newEndDate)} tint="royal" />
                <ResultTile label="New total interest" value={formatINR(sim.newTotalInterest)} tint="royal" />
              </div>
            )}
          </GlassCard>
        </>
      )}
    </PageShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold tabular">{value}</p>
    </div>
  );
}

function ResultTile({ label, value, tint }: { label: string; value: string; tint: "emerald" | "royal" }) {
  const tints = { emerald: "from-emerald/25 to-emerald/5 text-emerald", royal: "from-royal/25 to-royal/5 text-royal" };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${tints[tint]} p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular text-foreground">{value}</p>
    </div>
  );
}
