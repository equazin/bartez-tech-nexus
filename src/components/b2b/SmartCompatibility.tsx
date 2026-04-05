import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Sparkles, Info } from "lucide-react";
import type { Product } from "@/models/products";

interface Props {
  productId: number;
  isDark: boolean;
  onAddToCart: (p: any) => void;
  formatPrice: (amt: number) => string;
}

export function SmartCompatibility({ productId, isDark: _isDark, onAddToCart, formatPrice }: Props) {
  const [complements, setComplements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) return;
    fetchComplements();
  }, [productId]);

  async function fetchComplements() {
    setLoading(true);
    const { data } = await supabase
      .from("product_complements_view")
      .select("*")
      .eq("source_id", productId)
      .limit(3);
    if (data) setComplements(data);
    setLoading(false);
  }

  if (loading) return <div className="h-24 w-full animate-pulse bg-secondary rounded-2xl" />;
  if (complements.length === 0) return null;

  return (
    <div className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-primary" />
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary">Complementos Sugeridos (AI)</h4>
      </div>

      <div className="space-y-3">
        {complements.map((c) => (
          <div key={c.id} className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-border/70 flex items-center justify-center bg-white">
              <img src={c.image} alt={c.name} className="max-h-8 max-w-8 object-contain" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold truncate text-foreground">{c.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-extrabold text-primary tabular-nums">{formatPrice(c.price)}</span>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="text-[9px] text-muted-foreground font-medium truncate">{c.ai_rationale}</span>
              </div>
            </div>

            <button
              onClick={() => onAddToCart(c)}
              className="h-7 w-7 rounded-lg flex items-center justify-center transition bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Plus size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-primary/10 flex items-center gap-2">
        <Info size={11} className="text-muted-foreground" />
        <p className="text-[8px] text-muted-foreground italic">Análisis IA basado en requerimientos técnicos y compatibilidad de componentes.</p>
      </div>
    </div>
  );
}
