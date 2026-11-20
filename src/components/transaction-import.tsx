import { useMemo, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDb, uid, type Category } from "@/lib/db";
import {
  parseTransactionText,
  readLearnedCategories,
  rememberCategory,
  type ImportCandidate,
  type ExistingTransaction,
} from "@/lib/transaction-import";
import { useStore } from "@/lib/store";

export function TransactionImport({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, refresh } = useStore();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<
    (ImportCandidate & { suggestedCategory: string; skipDuplicate: boolean })[]
  >([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [parsed, setParsed] = useState(false);
  const categories = useMemo(
    () => data.category.filter((c: Category) => c.name !== "Loan EMI" && c.name !== "Card EMI"),
    [data.category],
  );

  function parse() {
    const existing: ExistingTransaction[] = [
      ...data.expense.map((item) => ({ ...item, kind: "expense" as const })),
      ...data.income.map((item) => ({ ...item, kind: "income" as const })),
    ];
    const result = parseTransactionText(text, {
      defaultDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
      categories: categories.map(({ name, kind }) => ({ name, kind })),
      existing,
      learned: readLearnedCategories(),
    });
    setRows(
      result.rows.map((row) => ({
        ...row,
        suggestedCategory: row.category,
        skipDuplicate: row.duplicate,
      })),
    );
    setErrors(result.errors);
    setParsed(true);
    if (!result.rows.length)
      toast.error("No transactions found. Use a description and amount, such as Dinner-600.");
  }

  async function loadFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("Choose a CSV or text file");
      return;
    }
    setText(await file.text());
    setRows([]);
    setParsed(false);
  }

  function update(index: number, changes: Partial<ImportCandidate>) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...changes };
        if (changes.recurrence === "one_time") next.months = null;
        if (changes.kind && !changes.category) {
          const available = categories.filter((c) => c.kind === changes.kind);
          next.category =
            available.find((c) => c.name === "Other")?.name ?? available[0]?.name ?? "";
        }
        return next;
      }),
    );
  }

  async function save() {
    const selected = rows.filter((row) => !row.skipDuplicate);
    if (!selected.length) return toast.error("No new transactions to save");
    for (const row of selected) {
      if (
        !row.title.trim() ||
        !Number.isFinite(row.amount) ||
        row.amount <= 0 ||
        !row.category ||
        !row.date
      ) {
        return toast.error(`Check transaction on line ${row.sourceLine}`);
      }
      if (
        !categories.some((category) => category.kind === row.kind && category.name === row.category)
      ) {
        return toast.error(`Choose a valid ${row.kind} category for line ${row.sourceLine}`);
      }
      if (
        row.recurrence === "monthly" &&
        row.months !== null &&
        (!Number.isInteger(row.months) || row.months < 1)
      ) {
        return toast.error(`Check the recurring duration on line ${row.sourceLine}`);
      }
    }
    const db = await getDb();
    const now = new Date().toISOString();
    for (const kind of ["expense", "income"] as const) {
      const batch = selected.filter((row) => row.kind === kind);
      if (!batch.length) continue;
      const tx = db.transaction(kind, "readwrite");
      for (const row of batch)
        await tx.store.put({
          id: uid(),
          title: row.title.trim(),
          amount: Number(row.amount),
          category: row.category,
          date: new Date(`${row.date}T12:00:00`).toISOString(),
          recurrence: row.recurrence,
          months: row.recurrence === "monthly" ? row.months : null,
          createdAt: now,
        });
      await tx.done;
    }
    for (const row of selected) {
      if (row.category !== row.suggestedCategory)
        rememberCategory(row.title, row.kind, row.category);
    }
    await refresh();
    toast.success(`${selected.length} transaction${selected.length === 1 ? "" : "s"} added`);
    setRows([]);
    setText("");
    setParsed(false);
    onOpenChange(false);
  }

  const pending = rows.filter((row) => !row.skipDuplicate).length;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          setRows([]);
          setErrors([]);
          setParsed(false);
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import transactions</DialogTitle>
          <DialogDescription>
            Paste a list or select a CSV/text file. Review every suggestion before saving; your data
            stays on this device.
          </DialogDescription>
        </DialogHeader>
        {!parsed ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="transaction-import-text">Paste transactions</Label>
              <Textarea
                id="transaction-import-text"
                rows={9}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  "November expenses\nReceived-173416\nRoad side momos-120\nFamily dinner-700"
                }
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/50">
              <FileUp className="h-4 w-4" /> Choose CSV or text file
              <input
                type="file"
                accept=".csv,.txt,text/plain,text/csv"
                className="sr-only"
                onChange={(event) => {
                  void loadFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <DialogFooter>
              <Button onClick={parse}>
                <Upload className="mr-1 h-4 w-4" /> Review transactions
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {pending} ready to add · {rows.length - pending} possible duplicates will be skipped
            </p>
            {errors.length > 0 && (
              <div className="max-h-24 overflow-auto rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700">
                {errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={`${row.sourceLine}-${index}`}
                  className={`rounded-xl border p-3 ${row.duplicate ? "border-amber-500/50 bg-amber-500/5" : ""}`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Line {row.sourceLine}
                      {row.duplicate ? " · Possible duplicate" : ""}
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{row.category !== row.suggestedCategory ? "Edited" : "Suggested"}</span>
                      {row.duplicate && (
                        <label className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={row.skipDuplicate}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((item, i) =>
                                  i === index
                                    ? { ...item, skipDuplicate: event.target.checked }
                                    : item,
                                ),
                              )
                            }
                          />
                          Skip duplicate
                        </label>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                    <div className="col-span-2 md:col-span-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={row.title}
                        onChange={(event) => update(index, { title: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Amount (₹)</Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={row.amount}
                        onChange={(event) => update(index, { amount: Number(event.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(event) => update(index, { date: event.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={row.kind}
                        onValueChange={(kind) =>
                          update(index, { kind: kind as ImportCandidate["kind"] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Category</Label>
                      <Select
                        value={row.category}
                        onValueChange={(category) => update(index, { category })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories
                            .filter((category) => category.kind === row.kind)
                            .map((category) => (
                              <SelectItem key={category.id} value={category.name}>
                                {category.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Repeats</Label>
                      <Select
                        value={row.recurrence}
                        onValueChange={(recurrence) =>
                          update(index, { recurrence: recurrence as ImportCandidate["recurrence"] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_time">One-time</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {row.recurrence === "monthly" && (
                      <div>
                        <Label className="text-xs">Months</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={row.months ?? ""}
                          placeholder="No end"
                          onChange={(event) =>
                            update(index, {
                              months: event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setParsed(false)}>
                Back
              </Button>
              <Button onClick={() => void save()} disabled={!pending}>
                Add {pending} transaction{pending === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
