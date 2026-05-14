import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusDotVariants = cva("inline-block rounded-full", {
  variants: {
    tone: {
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-danger",
      info: "bg-info",
      neutral: "bg-muted-foreground/60",
    },
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
      lg: "h-2.5 w-2.5",
    },
    pulse: {
      true: "animate-pulse",
      false: "",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "md",
    pulse: false,
  },
});

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusDotVariants> {
  label?: string;
}

const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ className, tone, size, pulse, label, ...props }, ref) => {
    if (label) {
      return (
        <span
          ref={ref}
          className={cn("inline-flex items-center gap-1.5 portal-tabular", className)}
          {...props}
        >
          <span aria-hidden className={cn(statusDotVariants({ tone, size, pulse }))} />
          <span className="text-[12px] leading-[16px] text-foreground">{label}</span>
        </span>
      );
    }
    return (
      <span
        ref={ref}
        aria-hidden
        className={cn(statusDotVariants({ tone, size, pulse }), className)}
        {...props}
      />
    );
  },
);
StatusDot.displayName = "StatusDot";

export { StatusDot };
