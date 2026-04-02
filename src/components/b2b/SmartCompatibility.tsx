import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Zap, ArrowRight, ShieldCheck, Plus, ShoppingCart, 
  Sparkles, Info, X 
} from "lucide-react";
import type { Product } from "@/models/products";

interface Props {
  productId: number;
  isDark: boolean;
  onAddToCart: (p: any) => void;
  formatPrice: (amt: number) => string;
}

export function SmartCompatibility({ productId, isDark, onAddToCart, formatPrice }: Props) {
  const [complements, setComplements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const dk = (d: string, l: string) => (isDark ? d : l);

  useEffect(() => {
    if (!productId) return;
    fetchComplements();
  }, [productId]);

  async function fetchComplements() {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_complements_view")
      .select("*")
      .eq("source_id", productId)
      .limit(3);

    if (data) setComplements(data);
    setLoading(false);
  }

  if (loading) return (
    <div className="h-24 w-full animate-pulse bg-gray-500/5 rounded-2xl" />
  );

  if (complements.length === 0) return null;

  return (
    <div className={`p-4 rounded-2xl border bg-gradient-to-br ${dk("from-[#2D9F6A]/5 to-transparent border-[#2D9F6A]/20", "from-emerald-50 to-white border-emerald-100")}`}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-[#2D9F6A]" />
        <h4 className="text-[11px] font-bold uppercase tracking-widest text-[#2D9F6A]">Complementos Sugeridos (AI)</h4>
      </div>

      <div className="space-y-3">
        {complements.map((c) => (
          <div key={c.id} className="flex items-center gap-3 group">
            <div className={`h-10 w-10 rounded-xl overflow-hidden border flex items-center justify-center bg-white ${dk("border-[#1f1f1f]", "border-[#eee]")}`}>
              <img src={c.image} alt={c.name} className="max-h-8 max-w-8 object-contain" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-bold truncate ${dk("text-white", "text-black")}`}>{c.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(c.price)}</span>
                <span className="h-1 w-1 rounded-full bg-gray-500" />
                <span className="text-[9px] text-gray-500 font-medium truncate">{c.ai_rationale}</span>
              </div>
            </div>

            <button 
              onClick={() => onAddToCart(c)}
              className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${dk("bg-[#2D9F6A]/10 text-[#2D9F6A] hover:bg-[#2D9F6A] hover:text-white", "bg-emerald-100 text-[#1a7a50] hover:bg-[#2D9F6A] hover:text-white")}`}
            >
              <Plus size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${dk("border-[#2D9F6A]/10", "border-emerald-100")}`}>
        <Info size={11} className="text-gray-500" />
        <p className="text-[8px] text-gray-500 italic">Análisis IA basado en requerimientos técnicos y compatibilidad de componentes.</p>
      </div>
    </div>
  );
}
