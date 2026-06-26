import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Landmark, CreditCard, Pencil, Trash2, ChevronDown, Calculator } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { MonthSwitcher } from "@/components/month-switcher";
import { GlassCard } from "@/components/glass-card";
import { EmptyState } from "@/components/empty-state";
import { LoanSheet } from "@/components/loan-sheet";
import { CardEmiSheet } from "@/components/card-emi-sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { computeLoanState, simulatePrepayment, computeCardEmiState } from "@/lib/finance";
import { formatINR, formatPercent, formatMonthLabel, formatDate, currentYm, ymAdd } from "@/lib/format";
import { getDb, type Loan, type CardEmi } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/loans")({
  head: () => ({
    meta: [
      { title: "Loans — LifeOps" },
      { name: "description", content: "Track every loan and credit-card EMI in one premium view." },
    ],
  }),
  component: LoansPage,
});

function LoansPage() {
  const { data, ym, refresh } = useStore();
  const [tab, setTab] = useState<"loans" | "cards">("loans");
  const [loanSheet, setLoanSheet] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [cardSheet, setCardSheet] = useState(false);
  const [editCard, setEditCard] = useState<CardEmi | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loansState = useMemo(
    () => data.loan.map(l => ({
      loan: l,
      state: computeLoanState(l.principal, l.annualRatePct, l.tenureMonths, l.startDate, ym),
    })),
    [data.loan, ym],
  );

  const cardsState = useMemo(
    () => data.cardemi.map(c => ({
      card: c,
      state: computeCardEmiState(c.startDate, c.tenureMonths, c.emiAmount, ym),
    })),
    [data.cardemi, ym],
  );

  const totalOutstanding = loansState.reduce((s, x) => s + x.state.outstanding, 0);
  const totalInterestLeft = loansState.reduce((s, x) => s + x.state.remainingInterest, 0);

  async function deleteLoan(id: string) {
    if (!confirm("Delete this loan? Its EMIs will no longer show.")) return;
    const db = await getDb();
    await db.delete("loan", id);
    await refresh();
    toast.success("Loan deleted");
  }
  async function deleteCard(id: string) {
    if (!confirm("Delete this card EMI?")) return;
    const db = await getDb();
    await db.delete("cardemi", id);
    await refresh();
    toast.success("Deleted");
  }

  return (
    <PageShell title="Loans" subtitle="Borrowing at a glance">
      <div className="mb-3"><MonthSwitcher /></div>

      <GlassCard variant="royal" className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Total outstanding</p>
        <p className="mt-1 text-3xl font-black tabular tracking-tight">{formatINR(totalOutstanding)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-[10px] uppercase tracking-wider text-white/70">Interest left</p>
            <p className="mt-1 text-base font-bold tabular">{formatINR(totalInterestLeft)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
            <p className="text-[10px] uppercase tracking-wider text-white/70">Total payable</p>
            <p className="mt-1 text-base font-bold tabular">{formatINR(totalOutstanding + totalInterestLeft)}</p>
          </div>
        </div>
      </GlassCard>

      <Tabs value={tab} onValueChange={(v) => setTab(v as never)} className="mt-4">
        <TabsList className="glass grid h-12 w-full grid-cols-2 rounded-2xl p-1">
          <TabsTrigger value="loans" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-royal/30 data-[state=active]:to-royal/10">
            <Landmark className="mr-1.5 h-4 w-4" /> Loans
          </TabsTrigger>
          <TabsTrigger value="cards" className="rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet/30 data-[state=active]:to-violet/10">
            <CreditCard className="mr-1.5 h-4 w-4" /> Card EMIs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="loans" className="mt-4 space-y-3">
          {loansState.length === 0 ? (
            <EmptyState icon={<Landmark className="h-6 w-6" />} title="No loans yet" description="Add a home, car, or personal loan to track EMIs automatically." />
          ) : loansState.map(({ loan, state }) => {
            const isOpen = expanded === loan.id;
            return (
              <GlassCard key={loan.id} className="p-4">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : loan.id)}
                  className="w-full text-left"
                  aria-expanded={isOpen}
                >
                  <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-royal/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-royal">{loan.type}</span>
                        <p className="truncate text-sm font-semibold">{loan.name}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{loan.bank} · {formatPercent(loan.annualRatePct, 2)}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <Stat label="EMI" value={formatINR(state.emi)} />
                    <Stat label="Outstanding" value={formatINR(state.outstanding)} />
                    <Stat label="Months paid" value={`${state.monthsPaid} / ${loan.tenureMonths}`} />
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/5">
                    <div className="h-full rounded-full bg-gradient-to-r from-royal to-violet" style={{ width: `${state.completionPct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{formatPercent(state.completionPct, 1)} paid · {state.monthsRemaining} months remaining</span>
                    {state.nextEmiDate && <span>Next: {formatDate(state.nextEmiDate)}</span>}
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-foreground/10 pt-4">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Detail label="Bank" value={loan.bank} />
                      <Detail label="Loan amount" value={formatINR(loan.principal)} />
                      <Detail label="Interest rate" value={formatPercent(loan.annualRatePct, 2)} />
                      <Detail label="Monthly EMI" value={formatINR(state.emi)} />
                      <Detail label="Outstanding principal" value={formatINR(state.outstanding)} />
                      <Detail label="Total interest" value={formatINR(state.totalInterest)} />
                      <Detail label="Remaining interest" value={formatINR(state.remainingInterest)} />
                      <Detail label="Total paid" value={formatINR(state.totalPaid)} />
                      <Detail label="Principal paid" value={formatINR(state.principalPaid)} />
                      <Detail label="Months paid" value={`${state.monthsPaid} / ${loan.tenureMonths}`} />
                      <Detail label="Months remaining" value={`${state.monthsRemaining}`} />
                      <Detail label="Next EMI" value={state.nextEmiDate ? formatDate(state.nextEmiDate) : "—"} />
                      <Detail label="Start date" value={formatDate(loan.startDate)} />
                      <Detail label="End date" value={formatDate(state.endDate)} />
                      <Detail label="Completion" value={formatPercent(state.completionPct, 1)} />
                    </div>

                    {loan.type === "home" && <PrepaymentSimulator loan={loan} />}

                    <div className="flex justify-end gap-1 pt-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditLoan(loan); setLoanSheet(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteLoan(loan.id); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose/15 hover:text-rose">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </TabsContent>

        <TabsContent value="cards" className="mt-4 space-y-3">
          {cardsState.length === 0 ? (
            <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No card EMIs" description="Track credit card EMI purchases here." />
          ) : cardsState.map(({ card, state }) => (
            <GlassCard key={card.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{card.merchant}</p>
                <p className="tabular text-sm font-bold">{formatINR(card.emiAmount)}<span className="text-xs font-normal text-muted-foreground"> / mo</span></p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">Purchase {formatINR(card.purchaseAmount)} · {card.tenureMonths} months</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Paid" value={formatINR(state.totalPaid)} />
                <Stat label="Remaining" value={formatINR(state.remainingAmount)} />
                <Stat label="Months paid" value={`${state.monthsPaid} / ${card.tenureMonths}`} />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/5">
                <div className="h-full rounded-full bg-gradient-to-r from-violet to-rose" style={{ width: `${(state.monthsPaid / card.tenureMonths) * 100}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {state.monthsRemaining} months remaining
                {state.nextEmiDate ? ` · Next: ${formatDate(state.nextEmiDate)}` : ""}
              </p>
              <div className="mt-2 flex justify-end gap-1">
                <button onClick={() => { setEditCard(card); setCardSheet(true); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => deleteCard(card.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-rose/15 hover:text-rose">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </GlassCard>
          ))}
        </TabsContent>
      </Tabs>

      <button
        onClick={() => {
          if (tab === "loans") { setEditLoan(null); setLoanSheet(true); }
          else { setEditCard(null); setCardSheet(true); }
        }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-1/2 z-30 grid h-14 w-14 translate-x-[calc(50%+min(50vw-32px,192px))] place-items-center rounded-full gradient-royal text-white shadow-glow"
        aria-label="Add"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <LoanSheet open={loanSheet} onOpenChange={(o) => { setLoanSheet(o); if (!o) setEditLoan(null); }} editing={editLoan} />
      <CardEmiSheet open={cardSheet} onOpenChange={(o) => { setCardSheet(o); if (!o) setEditCard(null); }} editing={editCard} />
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/5 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-bold tabular">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-foreground/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold tabular">{value}</p>
    </div>
  );
}

function PrepaymentSimulator({ loan }: { loan: Loan }) {
  const [extra, setExtra] = useState("");
  const [lump, setLump] = useState("");
  const [lumpYm, setLumpYm] = useState(currentYm());
  const [open, setOpen] = useState(false);

  const sim = useMemo(() => {
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

  function reset() {
    setExtra(""); setLump(""); setLumpYm(currentYm());
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald/10 via-royal/5 to-violet/10 p-3">
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (!next) reset(); }}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald">
          <Calculator className="h-3.5 w-3.5" /> Prepayment Simulator
        </span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">Calculator only — nothing is saved.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`extra-${loan.id}`} className="text-[11px]">Extra monthly (₹)</Label>
              <Input id={`extra-${loan.id}`} type="number" inputMode="decimal" value={extra} onChange={e => setExtra(e.target.value)} placeholder="5000" />
            </div>
            <div>
              <Label htmlFor={`lump-${loan.id}`} className="text-[11px]">One-time lump sum (₹)</Label>
              <Input id={`lump-${loan.id}`} type="number" inputMode="decimal" value={lump} onChange={e => setLump(e.target.value)} placeholder="100000" />
            </div>
          </div>
          {Number(lump) > 0 && (
            <div>
              <Label htmlFor={`lumpYm-${loan.id}`} className="text-[11px]">Lump-sum month</Label>
              <select
                id={`lumpYm-${loan.id}`}
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
          {sim ? (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <ResultTile label="Interest saved" value={formatINR(sim.interestSaved)} tint="emerald" />
              <ResultTile label="Months saved" value={`${sim.monthsSaved}`} tint="emerald" />
              <ResultTile label="New end date" value={formatDate(sim.newEndDate)} tint="royal" />
              <ResultTile label="New total interest" value={formatINR(sim.newTotalInterest)} tint="royal" />
              <div className="col-span-2">
                <ResultTile label="Total savings" value={formatINR(sim.interestSaved)} tint="gold" />
              </div>
            </div>
          ) : (
            <p className="text-[11px] italic text-muted-foreground">Enter an amount above to see what you'd save.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultTile({ label, value, tint }: { label: string; value: string; tint: "emerald" | "royal" | "gold" }) {
  const tints = {
    emerald: "from-emerald/25 to-emerald/5 text-emerald",
    royal: "from-royal/25 to-royal/5 text-royal",
    gold: "from-gold/25 to-gold/5 text-gold",
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${tints[tint]} p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular text-foreground">{value}</p>
    </div>
  );
}
