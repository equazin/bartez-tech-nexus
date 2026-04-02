import { useState } from "react";
import { Sparkles, Loader2, Wand2, Check, RefreshCcw } from "lucide-react";

interface Props {
  productName: string;
  sku: string;
  category: string;
  onGenerate: (description: string) => void;
  isDark: boolean;
}

export function AIContentGenerator({ productName, sku, category, onGenerate, isDark }: Props) {
  const [generating, setGenerating] = useState(false);
  const dk = (d: string, l: string) => (isDark ? d : l);

  async function handleGenerate() {
    setGenerating(true);
    try {
      // Logic for AI generation (Calling /api/ai-generate or similar)
      const response = await fetch("/api/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Genera una descripción técnica profesional y vendedora para un portal B2B en Argentina. 
                   Producto: ${productName}. 
                   Categoría: ${category}. 
                   SKU: ${sku}. 
                   Formato: Párrafo persuasivo seguido de una lista de 3 bullets técnicos.`
        })
      });
      
      const { text } = await response.json();
      if (text) onGenerate(text);
    } catch (err) {
      console.error("AI Generation Error:", err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={`p-4 rounded-2xl border ${dk("bg-[#1a1a1a] border-[#2d2d2d]", "bg-gray-50 border-gray-200")}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#2D9F6A]" />
          <h4 className={`text-xs font-bold ${dk("text-white", "text-black")}`}>Asistente de Contenido IA</h4>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !productName}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
            dk("bg-[#2D9F6A]/20 text-[#2D9F6A] hover:bg-[#2D9F6A]/30", "bg-emerald-100 text-emerald-700 hover:bg-emerald-200")
          } disabled:opacity-50`}
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          Generar descripción
        </button>
      </div>
      <p className="text-[10px] text-gray-500 leading-relaxed italic">
        "Optimiza tus productos automáticamente. La IA analizará el nombre y categoría para crear una descripción técnica persuasiva adaptada al mercado IT local."
      </p>
    </div>
  );
}
