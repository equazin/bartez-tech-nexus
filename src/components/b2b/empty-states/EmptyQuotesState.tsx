import { FileText, ArrowRight, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyQuotesStateProps {
  onGoToCatalog: () => void;
  onGoToCart: () => void;
}

export function EmptyQuotesState({ onGoToCatalog, onGoToCart }: EmptyQuotesStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-blue-500/10">
        <FileText size={28} className="text-blue-500" />
      </div>

      <h3 className="mt-5 text-lg font-bold text-foreground">
        Sin cotizaciones activas
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Armá un carrito con los productos que necesitás y guardalo como cotización.
        Podés reutilizarla, enviarla a tu cliente o convertirla en pedido cuando quieras.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          onClick={onGoToCatalog}
          className="gap-2 rounded-2xl bg-gradient-primary shadow-lg shadow-primary/20"
        >
          Explorar catálogo
          <ArrowRight size={13} />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onGoToCart}
          className="gap-2 rounded-2xl"
        >
          <ShoppingCart size={14} />
          Ir al checkout
        </Button>
      </div>

      <p className="mt-8 max-w-xs text-[11px] leading-relaxed text-muted-foreground/70">
        Las cotizaciones se guardan en tu cuenta y podés accederlas desde cualquier dispositivo.
        Tienen validez comercial según las condiciones vigentes.
      </p>
    </div>
  );
}
