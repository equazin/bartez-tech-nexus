import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  align?: "left" | "center";
}

function PageHeader({
  className,
  eyebrow,
  title,
  description,
  actions,
  align = "left",
  ...props
}: PageHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-[22px] border border-border/80 bg-card/80 p-4 shadow-sm md:p-5",
        centered ? "items-center text-center" : "items-start text-left",
        className,
      )}
      {...props}
    >
      <div className="space-y-2.5">
        {eyebrow ? (
          <span className="inline-flex rounded-full border border-primary/10 bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-foreground">
            {eyebrow}
          </span>
        ) : null}
        <div className="space-y-1.5">
          <h1 className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">{title}</h1>
          {description ? <p className="max-w-2xl text-[13px] leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className={cn("flex w-full gap-3", centered ? "justify-center" : "justify-start")}>{actions}</div> : null}
    </div>
  );
}

export { PageHeader };
