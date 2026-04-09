import {
  ShoppingCart, Truck, CreditCard, CheckCircle2,
  ChevronRight, ChevronLeft, Package2, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckoutStep = 1 | 2 | 3 | 4;

const STEPS = [
  { step: 1 as const, label: "Carrito",   icon: ShoppingCart },
  { step: 2 as const, label: "Entrega",   icon: Truck },
  { step: 3 as const, label: "Pago",      icon: CreditCard },
  { step: 4 as const, label: "Confirmar", icon: CheckCircle2 },
];

interface CheckoutStepperProps {
  currentStep: CheckoutStep;
  completedSteps: Set<CheckoutStep>;
  onStepClick: (step: CheckoutStep) => void;
}

export function CheckoutStepper({ currentStep, completedSteps, onStepClick }: CheckoutStepperProps) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map(({ step, label, icon: Icon }, index) => {
        const isActive = step === currentStep;
        const isCompleted = completedSteps.has(step);
        const isClickable = isCompleted || step <= currentStep;

        return (
          <div key={step} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isCompleted
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground",
                isClickable && !isActive && "cursor-pointer",
                !isClickable && "opacity-40 cursor-not-allowed",
              )}
            >
              <div className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : isCompleted
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}>
                {isCompleted && !isActive ? (
                  <CheckCircle2 size={12} />
                ) : (
                  step
                )}
              </div>
              <span className="hidden sm:inline">{label}</span>
              <Icon size={12} className="sm:hidden" />
            </button>
            {index < STEPS.length - 1 && (
              <ChevronRight size={12} className="mx-0.5 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface StepNavigationProps {
  currentStep: CheckoutStep;
  canAdvance: boolean;
  isLastStep: boolean;
  onPrev: () => void;
  onNext: () => void;
  advanceLabel?: string;
}

export function StepNavigation({
  currentStep,
  canAdvance,
  isLastStep,
  onPrev,
  onNext,
  advanceLabel,
}: StepNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/50 mt-4">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onPrev}
          className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground hover:border-border"
        >
          <ChevronLeft size={14} />
          Anterior
        </button>
      ) : (
        <div />
      )}

      {!isLastStep && (
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold transition-all",
            canAdvance
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed opacity-60",
          )}
        >
          {advanceLabel ?? "Siguiente"}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
