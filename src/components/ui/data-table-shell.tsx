import * as React from "react";

import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface DataTableShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

function DataTableShell({
  className,
  title,
  description,
  actions,
  meta,
  children,
  ...props
}: DataTableShellProps) {
  return (
    <SurfaceCard tone="default" padding="none" className={cn("overflow-hidden", className)} {...props}>
      <div className="flex flex-col gap-4 border-b border-border/70 px-6 py-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </SurfaceCard>
  );
}

export { DataTableShell };
