import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { Download, Upload, Trash2, Moon, Sun, Laptop, FolderTree, ChevronRight, User } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { GlassCard } from "@/components/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { exportAll, importAll, resetAll } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — LifeOps" }, { name: "description", content: "Theme, backup, restore — LifeOps settings." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme, refresh, userName, setUserName } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState(userName);
  useEffect(() => { setNameDraft(userName); }, [userName]);

  async function doExport() {
    const json = await exportAll();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeops-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  async function doImport(file: File) {
    try {
      const text = await file.text();
      await importAll(text);
      await refresh();
      toast.success("Backup restored");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't read that file");
    }
  }

  async function doReset() {
    if (!confirm("Delete ALL data? This cannot be undone.")) return;
    await resetAll();
    await refresh();
    toast.success("All data cleared");
  }

  return (
    <PageShell title="Settings" subtitle="Make it yours">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">You</h2>
      <GlassCard className="p-4">
        <Label htmlFor="userName" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="h-3.5 w-3.5" /> Your name
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="userName"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="What should we call you?"
            maxLength={40}
          />
          <Button
            onClick={async () => { await setUserName(nameDraft.trim()); toast.success("Saved"); }}
            disabled={nameDraft.trim() === userName}
            className="shrink-0"
          >
            Save
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Used for greetings and your monthly report.</p>
      </GlassCard>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">Theme</h2>
      <GlassCard className="p-2">
        <div className="grid grid-cols-3 gap-1">
          {([
            { v: "light", icon: Sun, label: "Light" },
            { v: "dark", icon: Moon, label: "Dark" },
            { v: "system", icon: Laptop, label: "Auto" },
          ] as const).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setTheme(v)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-3 text-xs font-semibold transition-colors ${
                theme === v ? "bg-gradient-to-br from-primary/30 to-primary/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </GlassCard>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">Organize</h2>
      <Link to="/categories" className="block">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet/25 to-violet/5 text-violet">
                <FolderTree className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Categories</p>
                <p className="text-xs text-muted-foreground">Add, rename, recolor</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </GlassCard>
      </Link>

      <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">Data</h2>
      <div className="space-y-2">
        <GlassCard className="p-2">
          <Button onClick={doExport} variant="ghost" className="h-12 w-full justify-start rounded-2xl text-sm font-semibold">
            <Download className="mr-3 h-4 w-4 text-emerald" /> Export backup (JSON)
          </Button>
        </GlassCard>
        <GlassCard className="p-2">
          <Button onClick={() => fileRef.current?.click()} variant="ghost" className="h-12 w-full justify-start rounded-2xl text-sm font-semibold">
            <Upload className="mr-3 h-4 w-4 text-royal" /> Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.currentTarget.value = ""; }}
          />
        </GlassCard>
        <GlassCard className="p-2">
          <Button onClick={doReset} variant="ghost" className="h-12 w-full justify-start rounded-2xl text-sm font-semibold text-rose hover:bg-rose/10 hover:text-rose">
            <Trash2 className="mr-3 h-4 w-4" /> Reset everything
          </Button>
        </GlassCard>
      </div>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        Everything stays on this device. No cloud, no accounts.<br />Add to home screen for the full app feel.
      </p>
    </PageShell>
  );
}
