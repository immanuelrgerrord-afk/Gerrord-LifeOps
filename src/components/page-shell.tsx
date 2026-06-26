import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-32 pt-[max(env(safe-area-inset-top),16px)]", className)}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 pb-4 pt-2">
          <div className="min-w-0">
            {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
