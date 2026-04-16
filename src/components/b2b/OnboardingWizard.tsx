import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Package, RotateCcw, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const WIZARD_KEY = "b2b_onboarding_done";

export function useOnboardingWizard() {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(WIZARD_KEY);
  });

  const dismiss = () => {
    window.localStorage.setItem(WIZARD_KEY, "1");
    setOpen(false);
  };

  return { open, dismiss };
}

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  clientName?: string;
  onGoToCatalog: () => void;
}

const FEATURES = [
  {
    icon: Package,
    color: "bg-primary/10 text-primary",
    title: "Catálogo B2B con precios exclusivos",
    description: "Accedé a precios de distribuidor, stock en tiempo real y condiciones comerciales acordadas.",
  },
  {
    icon: Zap,
    color: "bg-amber-500/10 text-amber-500",
    title: "Pedidos y cotizaciones en minutos",
    description: "Armá pedidos desde el carrito o solicitá cotizaciones formales con un clic.",
  },
  {
    icon: RotateCcw,
    color: "bg-sky-500/10 text-sky-500",
    title: "Recompra rápida",
    description: "Una vez que hayas comprado, tus productos frecuentes aparecen primero para reordenar al instante.",
  },
  {
    icon: ClipboardList,
    color: "bg-emerald-500/10 text-emerald-500",
    title: "Gestión completa de cuenta",
    description: "Seguí tus pedidos, facturas, crédito disponible y comunicaciones desde un solo lugar.",
  },
];

const TIPS = [
  "Usá el buscador en el encabezado para encontrar por SKU o marca al instante.",
  'Activá "Solo con stock" para ver solo lo que podés pedir hoy.',
  "Guardá productos favoritos con la estrella para acceder más rápido la próxima vez.",
  "Desde el carrito podés convertir a pedido o a cotización según tu necesidad.",
];

export function OnboardingWizard({ open, onClose, clientName, onGoToCatalog }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  const handleFinish = () => {
    handleClose();
    onGoToCatalog();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-3xl border border-border/70 p-0 shadow-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-3 bg-muted",
              )}
            />
          ))}
        </div>

        {/* ── Step 0: Welcome ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col items-center gap-5 px-8 py-7 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
              <Sparkles size={28} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                ¡Bienvenido{clientName ? `, ${clientName.split(" ")[0]}` : ""}!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Accedés al portal B2B de Bartez Tech. En los próximos segundos te mostramos cómo sacarle el máximo provecho.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2.5">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-secondary/30 p-3 text-left">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", f.color)}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-foreground leading-snug">{f.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{f.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="button" onClick={() => setStep(1)} className="w-full rounded-xl">
              Continuar <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        )}

        {/* ── Step 1: Tips ────────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-5 px-8 py-7">
            <div className="text-center">
              <h2 className="text-lg font-bold text-foreground">Consejos para empezar</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuatro cosas que te van a ahorrar tiempo desde el primer pedido.
              </p>
            </div>
            <div className="space-y-3">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {i + 1}
                  </div>
                  <p className="text-sm text-foreground">{tip}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1 rounded-xl">
                Atrás
              </Button>
              <Button type="button" onClick={() => setStep(2)} className="flex-1 rounded-xl">
                Continuar <ArrowRight size={14} className="ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Done ────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-5 px-8 py-7 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10">
              <CheckCircle2 size={32} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">¡Todo listo!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ya podés explorar el catálogo, agregar productos al carrito y gestionar tus cotizaciones y pedidos.
              </p>
            </div>
            <div className="w-full rounded-2xl border border-border/60 bg-secondary/30 p-4 text-left space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Para empezar</p>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span>Tu crédito y condiciones ya están activos.</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Package size={14} className="text-primary shrink-0" />
                <span>El catálogo está actualizado con stock en tiempo real.</span>
              </div>
            </div>
            <div className="flex w-full gap-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1 rounded-xl">
                Ver más tarde
              </Button>
              <Button type="button" onClick={handleFinish} className="flex-1 rounded-xl">
                Ir al catálogo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
