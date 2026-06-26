import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass mx-auto flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center", className)}>
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
