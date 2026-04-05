import * as React from "react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyState({
  className,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  ...props
}: EmptyStateProps) {
  return (
    <SurfaceCard
      tone="subtle"
      padding="lg"
      className={cn("flex flex-col items-center justify-center gap-4 text-center", className)}
      {...props}
    >
      {icon ? <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div> : null}
      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button variant="soft" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </SurfaceCard>
  );
}

export { EmptyState };
