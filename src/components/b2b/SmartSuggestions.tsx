import { useEffect, useState } from "react";
import { Sparkles, ShoppingCart, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface RebuyRecommendation {
  product_id: number;
  product_name: string;
  product_image: string;
  product_sku: string;
  purchase_count: number;
  last_purchase_date: string;
  avg_days_interval: number;
  estimated_next_purchase: string;
  days_until_next: number;
}

interface SmartSuggestionsProps {
  isDark: boolean;
  onAddToCart: (productId: number) => void;
  formatPrice: (val: number) => string;
}

export function SmartSuggestions({ isDark, onAddToCart, formatPrice }: SmartSuggestionsProps) {
  const { profile } = useAuth();
  const [recommendations, setRecommendations] = useState<RebuyRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from("rebuy_recommendations")
          .select("*")
          .eq("client_id", profile.id)
          .limit(4);

        if (!error && data) {
          setRecommendations(data as RebuyRecommendation[]);
        }
      } catch (err) {
        console.error("Error fetching rebuy recommendations:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile?.id]);

  if (loading || recommendations.length === 0) return null;

  const dk = (d: string, l: string) => (isDark ? d : l);

  return (
    <div className={`mb-6 p-5 rounded-2xl border ${dk("bg-[#0d1410] border-[#1a2d21]", "bg-[#f0faf5] border-[#d1e7dd]")} transition-all`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#2D9F6A] flex items-center justify-center text-white shadow-lg shadow-green-500/20">
            <Sparkles size={16} fill="currentColor" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#1a7a50]")}`}>Sugerencias de Reabastecimiento IA</h3>
            <p className={`text-[10px] uppercase tracking-wider font-semibold ${dk("text-[#4a8563]", "text-[#4a8563]/70")}`}>Basado en tu frecuencia de compra habitual</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {recommendations.map((rec) => {
          const isUrgent = rec.days_until_next <= 0;
          return (
            <div key={rec.product_id} className={`flex flex-col p-4 rounded-xl border ${dk("bg-[#111] border-[#1f1f1f] hover:border-[#2D9F6A]/30", "bg-white border-[#e5e5e5] hover:border-[#2D9F6A]/30")} transition-all group`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`h-12 w-12 rounded-lg ${dk("bg-[#0d0d0d]", "bg-[#f9f9f9]")} flex items-center justify-center border shrink-0`}>
                  <img src={rec.product_image} alt={rec.product_name} className="max-h-10 max-w-10 object-contain p-1" />
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold truncate leading-tight ${dk("text-white", "text-[#171717]")}`}>{rec.product_name}</p>
                  <p className="text-[10px] font-mono text-gray-500 mt-0.5">{rec.product_sku}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4 flex-1">
                <div className="flex items-center justify-between gap-2">
                   <span className="text-[10px] text-gray-500 flex items-center gap-1"><Clock size={10} /> Frecuencia:</span>
                   <span className={`text-[10px] font-bold ${dk("text-gray-300", "text-[#525252]")}`}>Cada {rec.avg_days_interval} días</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                   <span className="text-[10px] text-gray-500 flex items-center gap-1"><Calendar size={10} /> Última compra:</span>
                   <span className={`text-[10px] font-bold ${dk("text-gray-300", "text-[#525252]")}`}>{new Date(rec.last_purchase_date).toLocaleDateString()}</span>
                </div>
                {isUrgent ? (
                  <div className={`mt-2 py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 ${dk("bg-red-500/10 text-red-400 border border-red-500/20", "bg-red-50 text-red-600 border border-red-200")}`}>
                    <AlertTriangle size={11} /> Stock crítico (hace {Math.abs(rec.days_until_next)}d)
                  </div>
                ) : (
                  <div className={`mt-2 py-1.5 px-2 rounded-lg text-[10px] font-bold flex items-center gap-1.5 ${dk("bg-blue-500/10 text-blue-400 border border-blue-500/20", "bg-blue-50 text-blue-600 border border-blue-200")}`}>
                    <Clock size={11} /> Faltan {rec.days_until_next} días
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                   onAddToCart(rec.product_id);
                   toast.success(`${rec.product_name} añadido sugerido`, { icon: <Sparkles size={14} className="text-[#2D9F6A]" /> });
                }}
                className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${dk("bg-[#1a1a1a] hover:bg-[#262626] text-[#2D9F6A] border border-[#2D9F6A]/20 hover:border-[#2D9F6A]/40", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#1a7a50] border border-[#1a7a50]/20 hover:border-[#1a7a50]/40")}`}
              >
                <ShoppingCart size={13} /> Agregar Reposición
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertTriangle({ size, className }: { size: number; className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
        </svg>
    )
}
