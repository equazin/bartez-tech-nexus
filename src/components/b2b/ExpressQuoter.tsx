import { FileSearch, Clock } from "lucide-react";
import { Product } from "@/models/products";

interface ExpressQuoterProps {
  products: Product[];
  onAddToCart: (product: Product, qty: number) => void;
  isDark: boolean;
}

export function ExpressQuoter({ products: _products, onAddToCart: _onAddToCart, isDark: _isDark }: ExpressQuoterProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-black tracking-tight text-foreground">Cotizador Express</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Pegá el texto o subí la cotización de tu proveedor actual y encontraremos mejores opciones automáticamente.
        </p>
      </div>

      <div className="border border-border/70 bg-card rounded-[32px] p-16 flex flex-col items-center justify-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileSearch size={32} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximamente</span>
          </div>
          <h3 className="text-lg font-bold text-foreground">Estamos construyendo esta función</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            El Cotizador Express va a permitirte pegar o subir una cotización de cualquier proveedor y comparar automáticamente con nuestros precios de partner.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          ¿Tenés un Excel o PDF ahora?{" "}
          <a
            href="mailto:licitaciones@bartez.com.ar"
            className="text-primary font-semibold hover:underline"
          >
            Envialo a licitaciones@bartez.com.ar
          </a>{" "}
          y te respondemos en menos de 1 hora.
        </p>
      </div>
    </div>
  );
}
