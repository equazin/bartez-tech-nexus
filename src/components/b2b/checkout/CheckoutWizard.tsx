import { useState, useCallback } from "react";
import { CheckoutStepper, StepNavigation, type CheckoutStep } from "./CheckoutStepper";
import { CartStep, type CartStepProps } from "./CartStep";
import { ShippingStep, type ShippingStepProps } from "./ShippingStep";
import { PaymentStep, type PaymentStepProps } from "./PaymentStep";
import { ConfirmStep, type ConfirmStepProps } from "./ConfirmStep";
import { CheckoutSummary, type CheckoutSummaryProps } from "./CheckoutSummary";

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
          // Shipping is always valid (retiro requires nothing, envio just warns)
          return true;
        case 3:
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
    setCurrentStep((prev) => Math.min(prev + 1, 4) as CheckoutStep);
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
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Step content */}
        <div className="flex-1 min-w-0">
          {currentStep === 1 && <CartStep {...cartStepProps} />}
          {currentStep === 2 && <ShippingStep {...shippingStepProps} />}
          {currentStep === 3 && <PaymentStep {...paymentStepProps} />}
          {currentStep === 4 && <ConfirmStep {...confirmStepProps} />}

          {/* Step navigation */}
          <StepNavigation
            currentStep={currentStep}
            canAdvance={canAdvanceFromStep(currentStep)}
            isLastStep={currentStep === 4}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        </div>

        {/* Summary sidebar */}
        <aside className="lg:w-[300px] shrink-0">
          <CheckoutSummary {...summaryProps} />
        </aside>
      </div>
    </div>
  );
}
