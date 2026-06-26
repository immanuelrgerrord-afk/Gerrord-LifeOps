import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FileDown, BarChart3 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { MonthSwitcher } from "@/components/month-switcher";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { summarizeMonth, incomeForMonth, manualExpensesForMonth, loanEmisForMonth, cardEmisForMonth, goalProgress } from "@/lib/aggregate";
import { formatINR, formatMonthLabel, formatPercent, formatDate } from "@/lib/format";
import { computeLoanState } from "@/lib/finance";
import { setupPdfFont, PDF_FONT } from "@/lib/pdf-font";
import { toast } from "sonner";

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
  const { data, ym, userName } = useStore();
  const summary = useMemo(() => summarizeMonth(ym, data.income, data.expense, data.loan, data.cardemi), [ym, data]);

  async function generatePdf() {
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void }).default;

      const incRows = incomeForMonth(data.income, ym);
      const loanEmis = loanEmisForMonth(data.loan, ym);
      const cardEmis = cardEmisForMonth(data.cardemi, ym);
      const manualExp = manualExpensesForMonth(data.expense, ym);
      const expenseEntryCount = manualExp.length + loanEmis.length + cardEmis.length;
      const activeLoans = data.loan.filter(l => {
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
        doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); doc.text("Income", margin, y); y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Title", "Category", "Date", "Amount"]],
          body: incRows.map(i => [i.item.title, i.item.category, formatDate(i.effectiveDate), formatINR(i.amount)]),
          theme: "striped", margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [34, 201, 138], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Expenses
      const expRows: [string, string, string, string][] = [];
      for (const e of loanEmis) expRows.push([e.loan.name, "Loan EMI", formatDate(e.effectiveDate), formatINR(e.amount)]);
      for (const e of cardEmis) expRows.push([e.card.merchant, "Card EMI", formatDate(e.effectiveDate), formatINR(e.amount)]);
      for (const e of manualExp) expRows.push([e.item.title, e.item.category, formatDate(e.effectiveDate), formatINR(e.amount)]);
      if (expRows.length) {
        if (y > 700) { doc.addPage(); y = margin; }
        doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); doc.text("Expenses", margin, y); y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Title", "Category", "Date", "Amount"]],
          body: expRows,
          theme: "striped", margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [232, 93, 58], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Categories
      const cats = Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]);
      if (cats.length && summary.totalExpenses > 0) {
        if (y > 680) { doc.addPage(); y = margin; }
        doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); doc.text("Expense Categories", margin, y); y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Category", "Amount", "Share"]],
          body: cats.map(([k, v]) => [k, formatINR(v), formatPercent((v / summary.totalExpenses) * 100, 1)]),
          theme: "striped", margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [85, 53, 175], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Loans
      if (data.loan.length) {
        if (y > 640) { doc.addPage(); y = margin; }
        doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); doc.text("Loan Summary", margin, y); y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Name", "Bank", "EMI", "Outstanding", "Interest left", "Months", "Done"]],
          body: data.loan.map(l => {
            const s = computeLoanState(l.principal, l.annualRatePct, l.tenureMonths, l.startDate, ym);
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
          theme: "striped", margin: { left: margin, right: margin },
          styles: { ...tableFont, fontSize: 9, cellPadding: 5 },
          headStyles: { ...tableHeadFont, fillColor: [59, 109, 255], textColor: 255 },
        });
        // @ts-expect-error lastAutoTable
        y = doc.lastAutoTable.finalY + 18;
      }

      // Goals
      if (data.goal.length) {
        if (y > 680) { doc.addPage(); y = margin; }
        doc.setFont(PDF_FONT, "bold"); doc.setFontSize(13); doc.text("Goals", margin, y); y += 8;
        autoTable(doc, {
          startY: y + 4,
          head: [["Goal", "Target", "Current", "Progress"]],
          body: data.goal.map(g => {
            const { pct } = goalProgress(g);
            return [g.name, formatINR(g.targetAmount), formatINR(g.currentAmount), formatPercent(pct, 1)];
          }),
          theme: "striped", margin: { left: margin, right: margin },
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
      <div className="mb-3"><MonthSwitcher /></div>

      <GlassCard variant="aurora" className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Monthly report</p>
            <p className="mt-1 text-xl font-bold tracking-tight">{formatMonthLabel(ym)}</p>
            <p className="mt-1 text-sm text-white/80">Income, expenses, EMIs, loans and goals — beautifully laid out.</p>
          </div>
          <BarChart3 className="h-6 w-6" />
        </div>
        <Button onClick={generatePdf} className="mt-4 h-12 w-full rounded-2xl bg-white text-base font-semibold text-black hover:bg-white/90">
          <FileDown className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </GlassCard>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">Preview</h2>
      <div className="grid grid-cols-2 gap-3">
        <Mini label="Income" value={formatINR(summary.income)} />
        <Mini label="Expenses" value={formatINR(summary.totalExpenses)} />
        <Mini label="Net savings" value={formatINR(summary.netSavings)} />
        <Mini label="Commitments" value={formatINR(summary.monthlyCommitments)} />
        <Mini label="Loan outstanding" value={formatINR(summary.outstanding)} />
        <Mini label="Interest left" value={formatINR(summary.remainingInterest)} />
      </div>

      <Link to="/settings" className="mt-5 block text-center text-xs font-medium text-primary">Backup or restore your data →</Link>
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
