import { useState, useCallback } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { CheckoutStepper, StepNavigation, type CheckoutStep } from "./CheckoutStepper";
import { CartStep, type CartStepProps } from "./CartStep";
import { ShippingStep, type ShippingStepProps } from "./ShippingStep";
import { PaymentStep, type PaymentStepProps } from "./PaymentStep";
import { ConfirmStep, type ConfirmStepProps } from "./ConfirmStep";
import { CheckoutSummary, type CheckoutSummaryProps } from "./CheckoutSummary";
import { cn } from "@/lib/utils";

export interface CheckoutWizardProps {
  cartStepProps: CartStepProps;
  shippingStepProps: ShippingStepProps;
  paymentStepProps: PaymentStepProps;
  confirmStepProps: ConfirmStepProps;
  summaryProps: CheckoutSummaryProps;
  hasCartItems: boolean;
  hasBlockingErrors: boolean;
  isDark: boolean;
}

export function CheckoutWizard({
  cartStepProps,
  shippingStepProps,
  paymentStepProps,
  confirmStepProps,
  summaryProps,
  hasCartItems,
  hasBlockingErrors,
  isDark,
}: CheckoutWizardProps) {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<CheckoutStep>>(new Set());

  const dk = (d: string, l: string) => (isDark ? d : l);

  const markCompleted = useCallback((step: CheckoutStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  }, []);

  const canAdvanceFromStep = useCallback(
    (step: CheckoutStep): boolean => {
      if (!hasCartItems) return false;
      switch (step) {
        case 1:
          return !hasBlockingErrors;
        case 2:
          return true;
        default:
          return false;
      }
    },
    [hasCartItems, hasBlockingErrors],
  );

  const handleNext = useCallback(() => {
    if (!canAdvanceFromStep(currentStep)) return;
    markCompleted(currentStep);
    setCurrentStep((prev) => Math.min(prev + 1, 3) as CheckoutStep);
  }, [canAdvanceFromStep, currentStep, markCompleted]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as CheckoutStep);
  }, []);

  const handleStepClick = useCallback(
    (step: CheckoutStep) => {
      if (step <= currentStep || completedSteps.has(step)) {
        setCurrentStep(step);
      }
    },
    [completedSteps, currentStep],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Stepper header */}
      <div className={`rounded-2xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
        <CheckoutStepper
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Body: step content + summary */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start pb-24 lg:pb-0">
        {/* Step content */}
        <div className="flex-1 min-w-0">
          {currentStep === 1 && <CartStep {...cartStepProps} />}
          {currentStep === 2 && (
            <div className="flex flex-col gap-4">
              <ShippingStep {...shippingStepProps} />
              <PaymentStep {...paymentStepProps} />
            </div>
          )}
          {currentStep === 3 && <ConfirmStep {...confirmStepProps} />}

          {/* Step navigation */}
          <StepNavigation
            currentStep={currentStep}
            canAdvance={canAdvanceFromStep(currentStep)}
            isLastStep={currentStep === 3}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>

        {/* Summary (mobile: inline below content, desktop: sticky sidebar) */}
        <aside className="lg:w-[300px] shrink-0">
          <CheckoutSummary {...summaryProps} />
        </aside>
      </div>

      {/* Mobile sticky bottom bar with total + contextual CTA */}
      <MobileTotalBar
        currentStep={currentStep}
        canAdvance={canAdvanceFromStep(currentStep)}
        hasCartItems={hasCartItems}
        grandTotal={summaryProps.grandTotal}
        formatPrice={summaryProps.formatPrice}
        currency={summaryProps.currency}
        cartItemCount={summaryProps.cartItemCount}
        onNext={handleNext}
        onConfirmOrder={confirmStepProps.onConfirmOrder}
        orderSubmitting={confirmStepProps.orderSubmitting}
        isDark={isDark}
      />
    </div>
  );
}

interface MobileTotalBarProps {
  currentStep: CheckoutStep;
  canAdvance: boolean;
  hasCartItems: boolean;
  grandTotal: number;
  formatPrice: (n: number) => string;
  currency: "ARS" | "USD";
  cartItemCount: number;
  onNext: () => void;
  onConfirmOrder: () => void;
  orderSubmitting: boolean;
  isDark: boolean;
}

function MobileTotalBar({
  currentStep,
  canAdvance,
  hasCartItems,
  grandTotal,
  formatPrice,
  currency,
  cartItemCount,
  onNext,
  onConfirmOrder,
  orderSubmitting,
  isDark,
}: MobileTotalBarProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  if (!hasCartItems) return null;

  const isLastStep = currentStep === 3;
  const ctaLabel = isLastStep ? "Confirmar pedido" : currentStep === 1 ? "Ir a entrega/pago" : "Revisar y confirmar";
  const ctaDisabled = isLastStep ? orderSubmitting : !canAdvance;
  const onClick = isLastStep ? onConfirmOrder : onNext;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t px-3 py-3 backdrop-blur lg:hidden",
        dk("bg-[#0a0a0a]/95 border-[#1f1f1f]", "bg-white/95 border-[#e5e5e5]"),
      )}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
    >
      <div className="mx-auto flex max-w-[1680px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Total · {cartItemCount} {cartItemCount === 1 ? "ref" : "refs"}
          </p>
          <p className="truncate text-base font-black leading-tight tabular-nums text-[#2D9F6A]">
            {formatPrice(grandTotal)}
          </p>
          <p className="text-[10px] text-gray-500">{currency}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={ctaDisabled}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.98]",
            ctaDisabled
              ? "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {orderSubmitting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              {ctaLabel}
              <ChevronRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
