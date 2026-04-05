import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const surfaceCardVariants = cva("rounded-[24px] border shadow-sm transition-[border-color,box-shadow,background-color,transform]", {
  variants: {
    tone: {
      default: "border-border/80 bg-card text-card-foreground shadow-[0_10px_30px_-24px_rgba(15,23,42,0.2)]",
      subtle: "border-border/80 bg-surface text-card-foreground shadow-[0_10px_30px_-24px_rgba(15,23,42,0.14)]",
      elevated: "border-border/80 bg-card/95 text-card-foreground shadow-[0_18px_48px_-32px_rgba(15,23,42,0.22)]",
      glass: "border-[hsl(var(--glass-border)/0.7)] bg-glass text-card-foreground shadow-[0_18px_48px_-32px_rgba(15,23,42,0.18)]",
    },
    padding: {
      none: "p-0",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
      xl: "p-10",
    },
  },
  defaultVariants: {
    tone: "default",
    padding: "md",
  },
});

export interface SurfaceCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceCardVariants> {}

const SurfaceCard = React.forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ className, tone, padding, ...props }, ref) => (
    <Card ref={ref} className={cn(surfaceCardVariants({ tone, padding }), className)} {...props} />
  ),
);
SurfaceCard.displayName = "SurfaceCard";

export { SurfaceCard, surfaceCardVariants };
