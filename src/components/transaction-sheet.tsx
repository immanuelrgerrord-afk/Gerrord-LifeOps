import { useEffect, useState } from "react";
import {
  FormDrawer,
  FormDrawerBody,
  FormDrawerContent,
  FormDrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getDb, uid, type Income, type Expense, type Category } from "@/lib/db";
import { useStore } from "@/lib/store";

type Kind = "income" | "expense";

export function TransactionSheet({
  open,
  onOpenChange,
  kind,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: Kind;
  editing?: Income | Expense | null;
}) {
  const { data, refresh } = useStore();
  const cats = data.category.filter(
    (c: Category) => c.kind === kind && c.name !== "Loan EMI" && c.name !== "Card EMI",
  );

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>("");
  const [recurring, setRecurring] = useState(false);
  const [months, setMonths] = useState<string>("");

  useEffect(() => {
    if (open) {
      if (editing) {
        setTitle(editing.title);
        setAmount(String(editing.amount));
        setDate(editing.date.slice(0, 10));
        setCategory(editing.category);
        setRecurring(editing.recurrence === "monthly");
        setMonths(editing.months ? String(editing.months) : "");
      } else {
        setTitle("");
        setAmount("");
        setDate(new Date().toISOString().slice(0, 10));
        setCategory(cats[0]?.name ?? "");
        setRecurring(false);
        setMonths("");
      }
    }
  }, [open, editing]); // eslint-disable-line

  async function save() {
    const amt = Number(amount);
    if (!title.trim()) return toast.error("Add a title");
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Amount must be positive");
    if (!category) return toast.error("Pick a category");
    const monthsN = months.trim() === "" ? null : Math.max(1, Math.floor(Number(months)));
    if (recurring && months.trim() !== "" && (!Number.isFinite(monthsN!) || monthsN! < 1)) {
      return toast.error("Months must be 1 or more");
    }

    const db = await getDb();
    const store = kind === "income" ? "income" : "expense";
    const id = editing?.id ?? uid();
    const record = {
      id,
      title: title.trim(),
      category,
      amount: amt,
      date: new Date(date + "T00:00:00").toISOString(),
      recurrence: recurring ? ("monthly" as const) : ("one_time" as const),
      months: recurring ? monthsN : null,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await db.put(store, record as never);
    await refresh();
    toast.success(editing ? "Updated" : "Added");
    onOpenChange(false);
  }

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange}>
      <FormDrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>{editing ? "Edit" : "Add"} {kind === "income" ? "income" : "expense"}</DrawerTitle>
          <DrawerDescription>{kind === "income" ? "Money coming in" : "Money going out"}</DrawerDescription>
        </DrawerHeader>
        <FormDrawerBody className="space-y-3 px-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "income" ? "Salary" : "Dinner with friends"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input id="amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="glass flex items-center justify-between rounded-2xl p-3">
            <div>
              <p className="text-sm font-medium">Recurring monthly</p>
              <p className="text-xs text-muted-foreground">Repeats every month from this date</p>
            </div>
            <Switch checked={recurring} onCheckedChange={setRecurring} />
          </div>
          {recurring && (
            <div>
              <Label htmlFor="months">Number of months (optional)</Label>
              <Input id="months" type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="Leave blank = forever" />
            </div>
          )}
        </FormDrawerBody>
        <FormDrawerFooter>
          <Button onClick={save} className="h-12 w-full rounded-2xl text-base font-semibold">
            {editing ? "Save changes" : "Add entry"}
          </Button>
        </FormDrawerFooter>
      </FormDrawerContent>
    </FormDrawer>
  );
}
