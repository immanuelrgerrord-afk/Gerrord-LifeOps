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
import { toast } from "sonner";
import { getDb, uid, type Loan, type LoanType } from "@/lib/db";
import { calcEMI } from "@/lib/finance";
import { formatINR } from "@/lib/format";
import { useStore } from "@/lib/store";

const TYPES: { v: LoanType; label: string }[] = [
  { v: "home", label: "Home" },
  { v: "car", label: "Car" },
  { v: "personal", label: "Personal" },
  { v: "education", label: "Education" },
  { v: "gold", label: "Gold" },
  { v: "business", label: "Business" },
];

export function LoanSheet({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Loan | null }) {
  const { refresh } = useStore();
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [type, setType] = useState<LoanType>("home");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name); setBank(editing.bank); setType(editing.type);
        setPrincipal(String(editing.principal)); setRate(String(editing.annualRatePct));
        setTenure(String(editing.tenureMonths)); setStart(editing.startDate.slice(0, 10));
      } else {
        setName(""); setBank(""); setType("home"); setPrincipal(""); setRate(""); setTenure(""); setStart(new Date().toISOString().slice(0, 10));
      }
    }
  }, [open, editing]);

  const p = Number(principal), r = Number(rate), t = Number(tenure);
  const emi = (Number.isFinite(p) && p > 0 && Number.isFinite(r) && Number.isFinite(t) && t > 0) ? calcEMI(p, r, t) : 0;

  async function save() {
    if (!name.trim()) return toast.error("Loan name required");
    if (!bank.trim()) return toast.error("Bank required");
    if (!Number.isFinite(p) || p <= 0) return toast.error("Principal must be positive");
    if (!Number.isFinite(r) || r < 0 || r > 100) return toast.error("Rate must be 0–100");
    if (!Number.isFinite(t) || t < 1) return toast.error("Tenure must be ≥ 1 month");
    const rec: Loan = {
      id: editing?.id ?? uid(),
      name: name.trim(),
      bank: bank.trim(),
      type,
      principal: p,
      annualRatePct: r,
      tenureMonths: Math.floor(t),
      startDate: new Date(start + "T00:00:00").toISOString(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    const db = await getDb();
    await db.put("loan", rec);
    await refresh();
    toast.success(editing ? "Loan updated" : "Loan added");
    onOpenChange(false);
  }

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange}>
      <FormDrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>{editing ? "Edit loan" : "Add loan"}</DrawerTitle>
          <DrawerDescription>EMI is auto-calculated and added to each month.</DrawerDescription>
        </DrawerHeader>
        <FormDrawerBody className="space-y-3 px-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LoanType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bank">Bank</Label>
              <Input id="bank" value={bank} onChange={e => setBank(e.target.value)} placeholder="HDFC" />
            </div>
          </div>
          <div>
            <Label htmlFor="name">Loan name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Apartment loan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="principal">Loan amount (₹)</Label>
              <Input id="principal" type="number" inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rate">Interest rate (% p.a.)</Label>
              <Input id="rate" type="number" inputMode="decimal" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="8.5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tenure">Tenure (months)</Label>
              <Input id="tenure" type="number" inputMode="numeric" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="240" />
            </div>
            <div>
              <Label htmlFor="start">Start date</Label>
              <Input id="start" type="date" value={start} onChange={e => setStart(e.target.value)} />
            </div>
          </div>
          {emi > 0 && (
            <div className="glass rounded-2xl p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly EMI</p>
              <p className="text-2xl font-black tabular">{formatINR(emi)}</p>
            </div>
          )}
        </FormDrawerBody>
        <FormDrawerFooter>
          <Button onClick={save} className="h-12 w-full rounded-2xl text-base font-semibold">
            {editing ? "Save changes" : "Add loan"}
          </Button>
        </FormDrawerFooter>
      </FormDrawerContent>
    </FormDrawer>
  );
}
