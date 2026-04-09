import { ClipboardList, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyOrdersStateProps {
  onGoToCatalog: () => void;
}

export function EmptyOrdersState({ onGoToCatalog }: EmptyOrdersStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary/10">
        <ClipboardList size={28} className="text-primary" />
      </div>

      <h3 className="mt-5 text-lg font-bold text-foreground">
        Aún no tenés pedidos
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Explorá el catálogo, armá tu carrito y confirmá tu primera compra.
        Tu ejecutivo de cuenta te contactará para confirmar condiciones.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={onGoToCatalog}
          className="gap-2 rounded-2xl bg-gradient-primary shadow-lg shadow-primary/20"
        >
          <Package size={14} />
          Ir al catálogo
          <ArrowRight size={13} />
        </Button>
      </div>

      <div className="mt-8 grid w-full max-w-sm gap-3 sm:grid-cols-3">
        {[
          { step: "1", label: "Explorá", hint: "Buscá por marca o categoría" },
          { step: "2", label: "Armá", hint: "Sumá al carrito o cotizá" },
          { step: "3", label: "Confirmá", hint: "Cerrá tu pedido online" },
        ].map(({ step, label, hint }) => (
          <div key={step} className="rounded-2xl border border-border/70 bg-card/80 p-3 text-center">
            <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
              {step}
            </div>
            <p className="mt-2 text-xs font-bold text-foreground">{label}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
