import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown, BarChart3, TrendingDown, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { MonthSwitcher } from "@/components/month-switcher";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { getDb } from "@/lib/db";
import { getBudgetProgress } from "@/lib/budgets";
import {
  summarizeMonth,
  incomeForMonth,
  manualExpensesForMonth,
  loanEmisForMonth,
  cardEmisForMonth,
  goalProgress,
} from "@/lib/aggregate";
import {
  formatINR,
  formatMonthLabel,
  formatMonthShort,
  formatPercent,
  formatDate,
  ymAdd,
} from "@/lib/format";
import { computeLoanState } from "@/lib/finance";
import { setupPdfFont, PDF_FONT } from "@/lib/pdf-font";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — LifeOps" },
      { name: "description", content: "Generate a beautiful monthly PDF report of your finances." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data, ym, userName, refresh } = useStore();
  const expenseCategories = useMemo(
    () => data.category.filter((category) => category.kind === "expense"),
    [data.category],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  useEffect(() => {
    if (!selectedCategoryId && expenseCategories[0]) setSelectedCategoryId(expenseCategories[0].id);
  }, [expenseCategories, selectedCategoryId]);
  useEffect(() => {
    const current = data.budget.find(
      (budget) => budget.ym === ym && budget.categoryId === selectedCategoryId,
    );
    setBudgetAmount(current ? String(current.amount) : "");
  }, [data.budget, selectedCategoryId, ym]);
  const summary = useMemo(
    () => summarizeMonth(ym, data.income, data.expense, data.loan, data.cardemi),
    [ym, data],
  );
  const trend = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const month = ymAdd(ym, index - 5);
        const monthSummary = summarizeMonth(
          month,
          data.income,
          data.expense,
          data.loan,
          data.cardemi,
        );
        return {
          label: formatMonthShort(month),
          expenses: Math.round(monthSummary.totalExpenses),
          income: Math.round(monthSummary.income),
          net: Math.round(monthSummary.netSavings),
        };
      }),
    [ym, data],
  );
  const savingIdeas = useMemo(() => {
    const ideas: { title: string; detail: string; amount?: number }[] = [];
    const currentBudgets = data.budget
      .filter((budget) => budget.ym === ym)
      .map((budget) => {
        const category = expenseCategories.find((item) => item.id === budget.categoryId);
        const spent = category ? (summary.expensesByCategory[category.name] ?? 0) : 0;
        return { category, progress: getBudgetProgress(spent, budget.amount) };
      })
      .filter((item) => item.category);
    const exceededBudgets = currentBudgets
      .filter((item) => item.progress.isOver)
      .sort((a, b) => b.progress.overBy - a.progress.overBy);
    for (const item of exceededBudgets.slice(0, 3)) {
      ideas.push({
        title: `${item.category!.name} is over budget by ${formatINR(item.progress.overBy)}`,
        detail: `You've used ${formatINR(item.progress.spent)} of your ${formatINR(item.progress.limit)} limit. Review recent ${item.category!.name.toLowerCase()} transactions to find a place to cut back.`,
        amount: item.progress.overBy,
      });
    }
    const previous = summarizeMonth(
      ymAdd(ym, -1),
      data.income,
      data.expense,
      data.loan,
      data.cardemi,
    );
    const budgetedCategoryIds = new Set(currentBudgets.map((item) => item.category!.id));
    const discretionary = Object.entries(summary.expensesByCategory)
      .filter(([category]) =>
        ["food", "shopping", "entertainment", "travel", "other"].includes(category.toLowerCase()),
      )
      .filter(
        ([category]) =>
          !expenseCategories.some(
            (item) => item.name === category && budgetedCategoryIds.has(item.id),
          ),
      )
      .sort((a, b) => b[1] - a[1])[0];
    if (discretionary && discretionary[1] > 0 && exceededBudgets.length === 0) {
      ideas.push({
        title: `Set a ${discretionary[0]} spending target`,
        detail: `A target 10% below this month's spend could free up about ${formatINR(discretionary[1] * 0.1)}. Adjust the target to fit your needs.`,
        amount: discretionary[1] * 0.1,
      });
    }
    const increases = Object.entries(summary.expensesByCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        increase: amount - (previous.expensesByCategory[category] ?? 0),
      }))
      .filter(
        (item) =>
          item.increase >= 500 &&
          item.increase >= (previous.expensesByCategory[item.category] ?? 0) * 0.1,
      )
      .sort((a, b) => b.increase - a.increase);
    if (increases[0] && exceededBudgets.length === 0)
      ideas.push({
        title: `${increases[0].category} spending rose ${formatINR(increases[0].increase)}`,
        detail:
          "Compare this month's transactions with last month and decide whether the change was one-off or needs a monthly limit.",
      });
    if (summary.income > 0 && summary.monthlyCommitments / summary.income >= 0.5)
      ideas.push({
        title: "Review fixed monthly commitments",
        detail: `EMIs and recurring expenses use ${formatPercent((summary.monthlyCommitments / summary.income) * 100, 0)} of recorded income. Check recurring bills and loan options when renewal or refinancing is available.`,
      });
    const highRateLoan = data.loan
      .filter((loan) => loan.annualRatePct >= 12)
      .sort((a, b) => b.annualRatePct - a.annualRatePct)[0];
    if (highRateLoan)
      ideas.push({
        title: `Review the ${highRateLoan.name} rate`,
        detail: `Recorded rate is ${formatPercent(highRateLoan.annualRatePct, 2)}. The loan page's prepayment simulator can estimate interest impact; check fees and keep an emergency buffer before acting.`,
      });
    if (!ideas.length && currentBudgets.length > 0)
      ideas.push({
        title: "You're within your category limits",
        detail: "Keep checking the remaining amounts during the month to avoid a late overspend.",
      });
    if (!ideas.length)
      ideas.push({
        title: "Keep tracking for useful comparisons",
        detail:
          "As you add transactions, LifeOps will highlight category increases and recurring commitments using simple rules.",
      });
    return ideas;
  }, [data, expenseCategories, summary, ym]);

  async function saveBudget() {
    const amount = Number(budgetAmount);
    if (!selectedCategoryId) return toast.error("Choose a category");
    if (!Number.isFinite(amount) || amount <= 0)
      return toast.error("Budget must be greater than zero");
    setBudgetSaving(true);
    try {
      const db = await getDb();
      const id = `${ym}:${selectedCategoryId}`;
      const previous = await db.get("budget", id);
      const now = new Date().toISOString();
      await db.put("budget", {
        id,
        ym,
        categoryId: selectedCategoryId,
        amount,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      });
      await refresh();
      toast.success("Monthly budget saved");
    } catch {
      toast.error("Couldn't save this budget");
    } finally {
      setBudgetSaving(false);
    }
  }

  async function removeBudget(id: string) {
    const db = await getDb();
    await db.delete("budget", id);
    await refresh();
    toast.success("Budget removed");
  }

  async function generatePdf() {
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void })
        .default;

      const incRows = incomeForMonth(data.income, ym);
      const loanEmis = loanEmisForMonth(data.loan, ym);
      const cardEmis = cardEmisForMonth(data.cardemi, ym);
      const manualExp = manualExpensesForMonth(data.expense, ym);
      const expenseEntryCount = manualExp.length + loanEmis.length + cardEmis.length;
      const activeLoans = data.loan.filter((l) => {
        const s = computeLoanState(l.principal, l.annualRatePct, l.tenureMonths, l.startDate, ym);
        return s.monthsRemaining > 0;
      });

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      await setupPdfFont(doc);
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = margin;
      const tableFont = { font: PDF_FONT, fontStyle: "normal" as const };
      const tableHeadFont = { font: PDF_FONT, fontStyle: "bold" as const };

      // Header
      doc.setFillColor(13, 16, 32);
      doc.rect(0, 0, pageW, 120, "F");
      doc.setTextColor(255);
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(22);
      doc.text("LifeOps Monthly Report", margin, 50);
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(12);
      doc.text(formatMonthLabel(ym), margin, 72);
      doc.setFontSize(10);
      if (userName) doc.text(`Prepared for ${userName}`, margin, 90);
      doc.setFontSize(9);
      doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, margin, 106);

      y = 150;

      // Overview block
      doc.setTextColor(20);
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(14);
      doc.text("Overview", margin, y);
      y += 8;
      autoTable(doc, {
        startY: y + 4,
        head: [["Item", "Count"]],
        body: [
          ["Income entries", String(incRows.length)],
          ["Expense entries", String(expenseEntryCount)],
          ["Active loans", String(activeLoans.length)],
          ["Goals", String(data.goal.length)],
        ],
        theme: "striped",
        margin: { left: margin, right: margin },
        styles: { ...tableFont, fontSize: 10, cellPadding: 6 },
        headStyles: { ...tableHeadFont, fillColor: [85, 53, 175], textColor: 255 },
      });
      // @ts-expect-error lastAutoTable
      y = doc.lastAutoTable.finalY + 20;

      // Monthly summary
      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(14);
      doc.text("Monthly Summary", margin, y);
      y += 8;

      const summaryRows: [string, string][] = [
        ["Monthly Income", formatINR(summary.income)],
        ["Total Expenses", formatINR(summary.totalExpenses)],
        ["  Manual expenses", formatINR(summary.manualExpenses)],
        ["  Loan EMIs", formatINR(summary.loanEmiTotal)],
        ["  Card EMIs", formatINR(summary.cardEmiTotal)],
        ["Monthly Commitments (info)", formatINR(summary.monthlyCommitments)],
        ["Net Savings", formatINR(summary.netSavings)],
        ["Loan Outstanding", formatINR(summary.outstanding)],
        ["Remaining Interest", formatINR(summary.remainingInterest)],
        ["Total Remaining Payable", formatINR(summary.outstanding + summary.remainingInterest)],
      ];
      autoTable(doc, {
        startY: y + 4,
        head: [["Metric", "Amount"]],
        body: summaryRows,
        theme: "striped",
        margin: { left: margin, right: margin },
        styles: { ...tableFont, fontSize: 10, cellPadding: 6 },
        headStyles: { ...tableHeadFont, fillColor: [34, 201, 138], textColor: 255 },
      });
      // @ts-expect-error lastAutoTable
      y = doc.lastAutoTable.finalY + 24;

      // Income
      if (incRows.length) {
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(13);
        doc.text("Income", margin, y);
        y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Title", "Category", "Date", "Amount"]],
          body: incRows.map((i) => [
            i.item.title,
            i.item.category,
            formatDate(i.effectiveDate),
            formatINR(i.amount),
          ]),
          theme: "striped",
          margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [34, 201, 138], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Expenses
      const expRows: [string, string, string, string][] = [];
      for (const e of loanEmis)
        expRows.push([e.loan.name, "Loan EMI", formatDate(e.effectiveDate), formatINR(e.amount)]);
      for (const e of cardEmis)
        expRows.push([
          e.card.merchant,
          "Card EMI",
          formatDate(e.effectiveDate),
          formatINR(e.amount),
        ]);
      for (const e of manualExp)
        expRows.push([
          e.item.title,
          e.item.category,
          formatDate(e.effectiveDate),
          formatINR(e.amount),
        ]);
      if (expRows.length) {
        if (y > 700) {
          doc.addPage();
          y = margin;
        }
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(13);
        doc.text("Expenses", margin, y);
        y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Title", "Category", "Date", "Amount"]],
          body: expRows,
          theme: "striped",
          margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [232, 93, 58], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Categories
      const cats = Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]);
      if (cats.length && summary.totalExpenses > 0) {
        if (y > 680) {
          doc.addPage();
          y = margin;
        }
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(13);
        doc.text("Expense Categories", margin, y);
        y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Category", "Amount", "Share"]],
          body: cats.map(([k, v]) => [
            k,
            formatINR(v),
            formatPercent((v / summary.totalExpenses) * 100, 1),
          ]),
          theme: "striped",
          margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [85, 53, 175], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Loans
      if (data.loan.length) {
        if (y > 640) {
          doc.addPage();
          y = margin;
        }
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(13);
        doc.text("Loan Summary", margin, y);
        y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Name", "Bank", "EMI", "Outstanding", "Interest left", "Months", "Done"]],
          body: data.loan.map((l) => {
            const s = computeLoanState(
              l.principal,
              l.annualRatePct,
              l.tenureMonths,
              l.startDate,
              ym,
            );
            return [
              l.name,
              l.bank,
              formatINR(s.emi),
              formatINR(s.outstanding),
              formatINR(s.remainingInterest),
              `${s.monthsPaid} / ${l.tenureMonths}`,
              formatPercent(s.completionPct, 1),
            ];
          }),
          theme: "striped",
          margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [59, 109, 255], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Goals
      if (data.goal.length) {
        if (y > 680) {
          doc.addPage();
          y = margin;
        }
        doc.setFont(PDF_FONT, "bold");
        doc.setFontSize(13);
        doc.text("Goals", margin, y);
        y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Goal", "Target", "Current", "Progress"]],
          body: data.goal.map((g) => {
            const { pct } = goalProgress(g);
            return [
              g.name,
              formatINR(g.targetAmount),
              formatINR(g.currentAmount),
              formatPercent(pct, 1),
            ];
          }),
          theme: "striped",
          margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [115, 88, 200], textColor: 255 },
        });
      }

      doc.save(`lifeops-${ym}.pdf`);
      toast.success("Report downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't generate report");
    }
  }

  return (
    <PageShell title="Reports" subtitle="Your money, in one document">
      <div className="mb-3">
        <MonthSwitcher />
      </div>

      <GlassCard variant="aurora" className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
              Monthly report
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight">{formatMonthLabel(ym)}</p>
            <p className="mt-1 text-sm text-white/80">
              Income, expenses, EMIs, loans and goals — beautifully laid out.
            </p>
          </div>
          <BarChart3 className="h-6 w-6" />
        </div>
        <Button
          onClick={generatePdf}
          className="mt-4 h-12 w-full rounded-2xl bg-white text-base font-semibold text-black hover:bg-white/90"
        >
          <FileDown className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </GlassCard>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Monthly category budgets
      </h2>
      <GlassCard className="space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Set a limit for this month. Your budget progress stays on this device and follows the
          selected month above.
        </p>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div className="min-w-0">
            <Label htmlFor="budget-category" className="text-xs">
              Category
            </Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger id="budget-category">
                <SelectValue placeholder="Choose category" />
              </SelectTrigger>
              <SelectContent>
                {expenseCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label htmlFor="budget-amount" className="text-xs">
              Limit (₹)
            </Label>
            <Input
              id="budget-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={budgetAmount}
              onChange={(event) => setBudgetAmount(event.target.value)}
              placeholder="e.g. 5000"
            />
          </div>
          <Button
            onClick={() => void saveBudget()}
            disabled={budgetSaving || !selectedCategoryId}
            className="h-10"
          >
            {budgetSaving
              ? "Saving…"
              : data.budget.some(
                    (budget) => budget.ym === ym && budget.categoryId === selectedCategoryId,
                  )
                ? "Update"
                : "Set"}
          </Button>
        </div>
        {data.budget.filter((budget) => budget.ym === ym).length === 0 ? (
          <p className="rounded-xl bg-foreground/5 p-3 text-xs text-muted-foreground">
            No limits set for {formatMonthLabel(ym)} yet.
          </p>
        ) : (
          <div className="space-y-2">
            {data.budget
              .filter((budget) => budget.ym === ym)
              .map((budget) => {
                const category = expenseCategories.find((item) => item.id === budget.categoryId);
                if (!category) return null;
                const progress = getBudgetProgress(
                  summary.expensesByCategory[category.name] ?? 0,
                  budget.amount,
                );
                return (
                  <div key={budget.id} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatINR(progress.spent)} spent of {formatINR(progress.limit)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-right">
                        <p
                          className={
                            progress.isOver
                              ? "text-xs font-semibold text-rose"
                              : "text-xs font-semibold text-emerald"
                          }
                        >
                          {progress.isOver
                            ? formatINR(progress.overBy) + " over"
                            : formatINR(progress.remaining) + " left"}
                        </p>
                        <button
                          aria-label={"Remove " + category.name + " budget"}
                          onClick={() => void removeBudget(budget.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose/10 hover:text-rose"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10"
                      role="progressbar"
                      aria-label={category.name + " budget used"}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, progress.percent)}
                    >
                      <div
                        className={
                          progress.isOver
                            ? "h-full rounded-full bg-rose transition-all"
                            : "h-full rounded-full bg-emerald transition-all"
                        }
                        style={{ width: progress.progressPercent + "%" }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatPercent(progress.percent, 0)} used</span>
                      <button
                        onClick={() => {
                          setSelectedCategoryId(category.id);
                          setBudgetAmount(String(budget.amount));
                        }}
                        className="font-medium text-primary"
                      >
                        Edit limit
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </GlassCard>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Preview
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Mini label="Income" value={formatINR(summary.income)} />
        <Mini label="Expenses" value={formatINR(summary.totalExpenses)} />
        <Mini label="Net savings" value={formatINR(summary.netSavings)} />
        <Mini label="Commitments" value={formatINR(summary.monthlyCommitments)} />
        <Mini label="Loan outstanding" value={formatINR(summary.outstanding)} />
        <Mini label="Interest left" value={formatINR(summary.remainingInterest)} />
      </div>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Six-month trend
      </h2>
      <GlassCard className="p-3">
        <div
          className="h-48"
          role="img"
          aria-label="Six-month income, expense, and net savings chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="reportExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--rose)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--rose)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reportNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--emerald)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--emerald)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => formatINR(value)}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                name="Income"
                stroke="var(--emerald)"
                fill="url(#reportNet)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke="var(--rose)"
                fill="url(#reportExpense)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="net"
                name="Net savings"
                stroke="var(--royal)"
                fill="transparent"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Where you could reduce spending
      </h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Suggestions use simple rules from your recorded transactions. Savings estimates are targets,
        not guarantees.
      </p>
      <div className="space-y-2">
        {savingIdeas.map((idea) => (
          <GlassCard key={idea.title} className="flex gap-3 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald/15 text-emerald">
              <TrendingDown className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{idea.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{idea.detail}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      <Link to="/settings" className="mt-5 block text-center text-xs font-medium text-primary">
        Backup or restore your data →
      </Link>
    </PageShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold tabular">{value}</p>
    </div>
  );
}
