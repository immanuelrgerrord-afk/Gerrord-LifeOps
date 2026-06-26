import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Target as TargetIcon, Pencil, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GlassCard } from "@/components/glass-card";
import { EmptyState } from "@/components/empty-state";
import {
  FormDrawer,
  FormDrawerBody,
  FormDrawerContent,
  FormDrawerFooter,
  FormDrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { getDb, uid, type Goal } from "@/lib/db";
import { goalProgress } from "@/lib/aggregate";
import { formatINR, formatDate, formatPercent } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/goals")({
  head: () => ({
    meta: [
      { title: "Goals — LifeOps" },
      { name: "description", content: "Set savings goals and track progress with beautiful rings." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const { data, refresh } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this goal?")) return;
    const db = await getDb();
    await db.delete("goal", id);
    await refresh();
    toast.success("Goal deleted");
  }

  return (
    <PageShell title="Goals" subtitle="What you're saving toward">
      {data.goal.length === 0 ? (
        <EmptyState icon={<TargetIcon className="h-6 w-6" />} title="No goals yet" description="Set a target — emergency fund, vacation, car — and watch it grow." />
      ) : (
        <div className="space-y-3">
          {data.goal.map(g => {
            const { pct, remaining } = goalProgress(g);
            return (
              <GlassCard key={g.id} className="p-4">
                <div className="grid grid-cols-[64px_1fr] items-center gap-3">
                  <Ring pct={pct} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{g.name}</p>
                    <p className="text-xs text-muted-foreground">Deadline · {formatDate(g.deadline)}</p>
                    <p className="mt-1 tabular text-sm font-bold">
                      {formatINR(g.currentAmount)} <span className="text-xs font-normal text-muted-foreground">/ {formatINR(g.targetAmount)}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatINR(remaining)} to go</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <button onClick={() => { setEditing(g); setOpen(true); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(g.id)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-rose/15 hover:text-rose"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <button
        onClick={() => { setEditing(null); setOpen(true); }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-1/2 z-30 grid h-14 w-14 translate-x-[calc(50%+min(50vw-32px,192px))] place-items-center rounded-full gradient-aurora text-white shadow-glow"
        aria-label="Add goal"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <GoalSheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }} editing={editing} />
    </PageShell>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="var(--border)" strokeWidth="6" fill="none" />
        <circle cx="32" cy="32" r={r} stroke="url(#gradGoal)" strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`} />
        <defs>
          <linearGradient id="gradGoal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--emerald)" />
            <stop offset="100%" stopColor="var(--royal)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[11px] font-bold tabular">{formatPercent(pct, 0)}</span>
    </div>
  );
}

function GoalSheet({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Goal | null }) {
  const { refresh } = useStore();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name); setTarget(String(editing.targetAmount));
        setCurrent(String(editing.currentAmount)); setDeadline(editing.deadline.slice(0, 10));
      } else { setName(""); setTarget(""); setCurrent(""); }
    }
  }, [open, editing]);

  async function save() {
    const t = Number(target), c = Number(current || "0");
    if (!name.trim()) return toast.error("Name required");
    if (!Number.isFinite(t) || t <= 0) return toast.error("Target must be positive");
    if (!Number.isFinite(c) || c < 0) return toast.error("Current must be ≥ 0");
    const rec: Goal = {
      id: editing?.id ?? uid(),
      name: name.trim(), targetAmount: t, currentAmount: c,
      deadline: new Date(deadline + "T00:00:00").toISOString(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    const db = await getDb();
    await db.put("goal", rec);
    await refresh();
    toast.success(editing ? "Goal updated" : "Goal added");
    onOpenChange(false);
  }

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange}>
      <FormDrawerContent className="mx-auto max-w-md">
        <FormDrawerHeader onClose={() => onOpenChange(false)}>
          <DrawerTitle>{editing ? "Edit goal" : "New goal"}</DrawerTitle>
          <DrawerDescription>Set a clear money target.</DrawerDescription>
        </FormDrawerHeader>
        <FormDrawerBody className="space-y-3 px-4 pb-2">
          <div>
            <Label htmlFor="gname">Goal name</Label>
            <Input id="gname" value={name} onChange={e => setName(e.target.value)} placeholder="Emergency fund" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="target">Target (₹)</Label>
              <Input id="target" type="number" value={target} onChange={e => setTarget(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="current">Current (₹)</Label>
              <Input id="current" type="number" value={current} onChange={e => setCurrent(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </FormDrawerBody>
        <FormDrawerFooter>
          <Button onClick={save} className="h-12 w-full rounded-2xl text-base font-semibold">
            {editing ? "Save changes" : "Add goal"}
          </Button>
        </FormDrawerFooter>
      </FormDrawerContent>
    </FormDrawer>
  );
}
