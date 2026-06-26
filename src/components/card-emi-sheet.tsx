import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getDb, uid, type CardEmi } from "@/lib/db";
import { useStore } from "@/lib/store";

export function CardEmiSheet({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing?: CardEmi | null }) {
  const { refresh } = useStore();
  const [merchant, setMerchant] = useState("");
  const [purchase, setPurchase] = useState("");
  const [emi, setEmi] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      if (editing) {
        setMerchant(editing.merchant); setPurchase(String(editing.purchaseAmount));
        setEmi(String(editing.emiAmount)); setRate(editing.annualRatePct ? String(editing.annualRatePct) : "");
        setTenure(String(editing.tenureMonths)); setStart(editing.startDate.slice(0, 10));
      } else {
        setMerchant(""); setPurchase(""); setEmi(""); setRate(""); setTenure(""); setStart(new Date().toISOString().slice(0, 10));
      }
    }
  }, [open, editing]);

  async function save() {
    const p = Number(purchase), e = Number(emi), t = Number(tenure);
    const r = rate.trim() === "" ? undefined : Number(rate);
    if (!merchant.trim()) return toast.error("Merchant required");
    if (!Number.isFinite(p) || p <= 0) return toast.error("Purchase amount must be positive");
    if (!Number.isFinite(e) || e <= 0) return toast.error("EMI must be positive");
    if (!Number.isFinite(t) || t < 1) return toast.error("Tenure must be ≥ 1");
    if (r !== undefined && (!Number.isFinite(r) || r < 0 || r > 100)) return toast.error("Rate must be 0–100");
    const rec: CardEmi = {
      id: editing?.id ?? uid(),
      merchant: merchant.trim(),
      purchaseAmount: p,
      emiAmount: e,
      annualRatePct: r,
      tenureMonths: Math.floor(t),
      startDate: new Date(start + "T00:00:00").toISOString(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    const db = await getDb();
    await db.put("cardemi", rec);
    await refresh();
    toast.success(editing ? "Updated" : "Added");
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle>{editing ? "Edit card EMI" : "Add card EMI"}</DrawerTitle>
          <DrawerDescription>Auto-added to expenses each month.</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-3 px-4 pb-6">
          <div>
            <Label htmlFor="merchant">Merchant / item</Label>
            <Input id="merchant" value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="iPhone 16 Pro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="purchase">Purchase amount (₹)</Label>
              <Input id="purchase" type="number" inputMode="decimal" value={purchase} onChange={e => setPurchase(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="emi">EMI amount (₹)</Label>
              <Input id="emi" type="number" inputMode="decimal" value={emi} onChange={e => setEmi(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tenure">Tenure (months)</Label>
              <Input id="tenure" type="number" value={tenure} onChange={e => setTenure(e.target.value)} placeholder="12" />
            </div>
            <div>
              <Label htmlFor="rate">Rate % p.a. (optional)</Label>
              <Input id="rate" type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="start">Start date</Label>
            <Input id="start" type="date" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <Button onClick={save} className="h-12 w-full rounded-2xl text-base font-semibold">
            {editing ? "Save changes" : "Add card EMI"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
