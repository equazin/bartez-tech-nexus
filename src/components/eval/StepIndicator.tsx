import { motion } from "framer-motion";

interface StepIndicatorProps {
  current: number; // 1-based
  total: number;
  labels?: string[];
}

export function StepIndicator({ current, total, labels }: StepIndicatorProps) {
  const pct = ((current - 1) / (total - 1)) * 100;

  return (
    <div className="w-full mb-8">
      {/* Label */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Paso {current} de {total}
        </span>
        {labels && (
          <span className="text-xs text-primary font-medium">{labels[current - 1]}</span>
        )}
      </div>

      {/* Bar */}
      <div className="relative h-1 w-full rounded-full bg-border/30 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 to-primary"
          initial={false}
          animate={{ width: `${pct === 0 ? 8 : pct}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />
      </div>

      {/* Dots */}
      <div className="flex justify-between mt-2.5">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <motion.div
              animate={{
                backgroundColor: i < current ? "hsl(var(--primary))" : i === current - 1 ? "hsl(var(--primary))" : "hsl(var(--border))",
                scale: i === current - 1 ? 1.2 : 1,
              }}
              transition={{ duration: 0.3 }}
              className="h-2 w-2 rounded-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
