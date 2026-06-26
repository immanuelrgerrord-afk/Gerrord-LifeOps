import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  variant = "glass",
}: {
  children: ReactNode;
  className?: string;
  variant?: "glass" | "solid" | "emerald" | "royal" | "sunset" | "gold" | "aurora";
}) {
  const variants: Record<string, string> = {
    glass: "glass",
    solid: "soft-card",
    emerald: "gradient-emerald text-white",
    royal: "gradient-royal text-white",
    sunset: "gradient-sunset text-white",
    gold: "gradient-gold text-white",
    aurora: "gradient-aurora text-white",
  };
  return (
    <div className={cn("relative overflow-hidden rounded-3xl", variants[variant], className)}>
      {variant !== "glass" && variant !== "solid" && (
        <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay [background:radial-gradient(120%_80%_at_0%_0%,rgba(255,255,255,.7),transparent_60%)]" />
      )}
      {children}
    </div>
  );
}
