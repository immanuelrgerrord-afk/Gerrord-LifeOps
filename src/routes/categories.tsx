import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GlassCard } from "@/components/glass-card";
import {
  FormDrawer,
  FormDrawerBody,
  FormDrawerContent,
  FormDrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { getDb, uid, type Category } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — LifeOps" }, { name: "description", content: "Customize your expense and income categories." }] }),
  component: CategoriesPage,
});

const COLORS = ["emerald", "royal", "tangerine", "violet", "gold", "rose"] as const;

function CategoriesPage() {
  const { data, refresh } = useStore();
  const [tab, setTab] = useState<"expense" | "income">("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const cats = data.category.filter(c => c.kind === tab);

  async function remove(cat: Category) {
    const store = cat.kind === "income" ? "income" : "expense";
    const items = store === "income" ? data.income : data.expense;
    const using = items.filter(x => x.category === cat.name);
    if (using.length > 0) {
      const other = data.category.find(c => c.kind === cat.kind && c.name === "Other");
      if (!other) {
        toast.error("Move transactions to another category first.");
        return;
      }
      const ok = confirm(`${using.length} entries use "${cat.name}". Move them to "Other" and delete?`);
      if (!ok) return;
      const db = await getDb();
      for (const it of using) {
        await db.put(store, { ...it, category: "Other" } as never);
      }
      await db.delete("category", cat.id);
      await refresh();
      toast.success("Moved and deleted");
    } else {
      if (!confirm(`Delete "${cat.name}"?`)) return;
      const db = await getDb();
      await db.delete("category", cat.id);
      await refresh();
      toast.success("Deleted");
    }
  }

  return (
    <PageShell title="Categories" subtitle="Group your money">
      <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
        <TabsList className="glass grid h-12 w-full grid-cols-2 rounded-2xl p-1">
          <TabsTrigger value="expense" className="rounded-xl">Expense</TabsTrigger>
          <TabsTrigger value="income" className="rounded-xl">Income</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            {cats.map(c => (
              <GlassCard key={c.id} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: `var(--${c.color})` }} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</p>
                </div>
                <div className="mt-2 flex justify-between">
                  {c.builtin ? <span className="text-[10px] text-muted-foreground">Built-in</span> : <span />}
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(c); setOpen(true); }} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5"><Pencil className="h-3.5 w-3.5" /></button>
                    {!c.builtin && (
                      <button onClick={() => remove(c)} className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-rose/15 hover:text-rose"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <button
        onClick={() => { setEditing(null); setOpen(true); }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+88px)] right-1/2 z-30 grid h-14 w-14 translate-x-[calc(50%+min(50vw-32px,192px))] place-items-center rounded-full gradient-sunset text-white shadow-glow"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <CategorySheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }} editing={editing} defaultKind={tab} />
    </PageShell>
  );
}

function CategorySheet({
  open, onOpenChange, editing, defaultKind,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editing?: Category | null; defaultKind: "expense" | "income";
}) {
  const { refresh, data } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("emerald");
  const [kind, setKind] = useState<"expense" | "income">(defaultKind);

  useEffect(() => {
    if (open) {
      if (editing) { setName(editing.name); setColor(editing.color); setKind(editing.kind); }
      else { setName(""); setColor("emerald"); setKind(defaultKind); }
    }
  }, [open, editing, defaultKind]);

  async function save() {
    if (!name.trim()) return toast.error("Name required");
    // Uniqueness check within kind
    const exists = data.category.some(c => c.kind === kind && c.name.toLowerCase() === name.trim().toLowerCase() && c.id !== editing?.id);
    if (exists) return toast.error("That name is already used");
    const rec: Category = {
      id: editing?.id ?? `usr-${uid()}`,
      name: name.trim(), color, icon: editing?.icon ?? "Sparkles", kind, builtin: editing?.builtin,
    };
    const db = await getDb();
    // If renaming a category, update transactions referencing the old name
    if (editing && editing.name !== rec.name) {
      const store = kind === "income" ? "income" : "expense";
      const items = store === "income" ? data.income : data.expense;
      for (const it of items.filter(x => x.category === editing.name)) {
        await db.put(store, { ...it, category: rec.name } as never);
      }
    }
    await db.put("category", rec);
    await refresh();
    toast.success(editing ? "Updated" : "Added");
    onOpenChange(false);
  }

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange}>
      <FormDrawerContent className="mx-auto max-w-md">
        <DrawerHeader><DrawerTitle>{editing ? "Edit category" : "New category"}</DrawerTitle></DrawerHeader>
        <FormDrawerBody className="space-y-3 px-4">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" value={name} onChange={e => setName(e.target.value)} placeholder="Dining out" />
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-9 w-9 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all ${color === c ? "ring-foreground scale-110" : "ring-transparent"}`}
                  style={{ background: `var(--${c})` }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </FormDrawerBody>
        <FormDrawerFooter>
          <Button onClick={save} className="h-12 w-full rounded-2xl text-base font-semibold">
            {editing ? "Save changes" : "Add category"}
          </Button>
        </FormDrawerFooter>
      </FormDrawerContent>
    </FormDrawer>
  );
}
