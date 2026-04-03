import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SelectCardProps {
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  label: string;
  desc?: string;
  compact?: boolean;
}

export function SelectCard({ selected, onClick, icon: Icon, label, desc, compact }: SelectCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full text-left rounded-xl border transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${compact ? "px-4 py-3" : "p-5"}
        ${selected
          ? "border-primary/60 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_0_20px_hsl(var(--primary)/0.06)]"
          : "border-border/40 bg-card hover:border-border/70 hover:bg-card/80"
        }`}
    >
      {/* Selected glow */}
      {selected && (
        <motion.div
          layoutId={undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-xl bg-primary/4 pointer-events-none"
        />
      )}

      <div className={`flex items-center gap-3 ${!compact && desc ? "mb-1" : ""}`}>
        {Icon && (
          <div className={`shrink-0 flex items-center justify-center rounded-lg transition-colors
            ${compact ? "h-7 w-7" : "h-9 w-9"}
            ${selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            <Icon size={compact ? 14 : 16} />
          </div>
        )}
        <span className={`font-semibold text-foreground leading-tight ${compact ? "text-sm" : "text-sm"}`}>{label}</span>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="ml-auto shrink-0"
          >
            <CheckCircle2 size={15} className="text-primary" />
          </motion.div>
        )}
      </div>
      {desc && !compact && (
        <p className={`text-xs leading-relaxed mt-1 ${Icon ? "pl-12" : ""} ${selected ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
          {desc}
        </p>
      )}
    </motion.button>
  );
}
