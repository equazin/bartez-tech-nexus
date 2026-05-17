import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonVariant = "table" | "form" | "dashboard" | "cards" | "list" | "detail";

interface TabSkeletonProps {
  variant: SkeletonVariant;
  /** Number of repeated rows/cards. Defaults vary per variant. */
  rows?: number;
  className?: string;
  /** Show the spinning indicator alongside the bones — useful for Suspense fallbacks. */
  spinner?: boolean;
}

/**
 * Unified loading skeleton for portal/admin tabs.
 *
 * Use instead of ad-hoc `<Skeleton />` blocks or `<Loader2 />` spinners so the
 * loading state looks consistent across the app. Each variant matches the
 * approximate layout of its target view.
 */
export function TabSkeleton({ variant, rows, className, spinner = false }: TabSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
      {spinner ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin text-primary" />
          Cargando…
        </div>
      ) : null}
      {renderVariant(variant, rows)}
    </div>
  );
}

function renderVariant(variant: SkeletonVariant, rows?: number) {
  switch (variant) {
    case "dashboard":
      return (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/70 bg-card p-4">
                <Skeleton className="mb-2 h-3 w-24" />
                <Skeleton className="h-7 w-20" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </>
      );

    case "table":
      return (
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/70 px-4 py-3">
            <Skeleton className="h-3 w-32" />
          </div>
          {Array.from({ length: rows ?? 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-2.5 w-1/4" />
              </div>
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
      );

    case "form":
      return (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
          {Array.from({ length: rows ?? 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      );

    case "cards":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: rows ?? 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/70 bg-card p-4">
              <Skeleton className="mb-3 aspect-square w-full rounded-xl" />
              <Skeleton className="mb-2 h-3 w-3/4" />
              <Skeleton className="mb-3 h-2.5 w-1/2" />
              <Skeleton className="h-7 w-full rounded-lg" />
            </div>
          ))}
        </div>
      );

    case "list":
      return (
        <div className="space-y-2">
          {Array.from({ length: rows ?? 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      );

    case "detail":
      return (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: rows ?? 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5 rounded-xl border border-border/60 bg-background/50 p-3">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      );

    default:
      return null;
  }
}
