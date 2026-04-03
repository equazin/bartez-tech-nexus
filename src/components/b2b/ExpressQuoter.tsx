import { useState } from "react";
import { Upload, FileSearch, Sparkles, CheckCircle2, TrendingDown, Clipboard, AlertCircle, ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Product } from "@/models/products";
import { formatMoneyAmount } from "@/lib/money";
import { useCurrency } from "@/context/CurrencyContext";
import { getAvailableStock } from "@/lib/pricing";

interface ComparisonItem {
  found: boolean;
  product?: Product;
  originalName: string;
  originalPrice?: number;
  savings?: number;
}

interface ExpressQuoterProps {
  products: Product[];
  onAddToCart: (product: Product, qty: number) => void;
  isDark: boolean;
}

export function ExpressQuoter({ products, onAddToCart, isDark }: ExpressQuoterProps) {
  const { currency } = useCurrency();
  const dk = (d: string, l: string) => isDark ? d : l;
  
  const [inputText, setInputText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<ComparisonItem[] | null>(null);

  const handleAnalyze = () => {
    if (!inputText) return;
    setAnalyzing(true);
    
    // Simulate smart parsing logic
    setTimeout(() => {
      const lines = inputText.split("\n").filter(l => l.trim().length > 3);
      const output: ComparisonItem[] = lines.map(line => {
        // Simple mock matching logic (in real life, we would use regex or vector search)
        const matchedProduct = products.find(p => 
          line.toLowerCase().includes(p.sku.toLowerCase()) || 
          line.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
        );

        if (matchedProduct) {
          // Simulate finding a competitor price in the string if it has symbols like $
          const priceMatch = line.match(/\$?([\d.,]+)/);
          const competitorPrice = priceMatch ? parseFloat(priceMatch[1].replace(".", "").replace(",", ".")) : undefined;
          
          return {
            found: true,
            product: matchedProduct,
            originalName: line,
            originalPrice: competitorPrice,
            savings: competitorPrice ? (competitorPrice - (matchedProduct.unit_price || 0)) : undefined
          };
        }

        return { found: false, originalName: line };
      });

      setResults(output);
      setAnalyzing(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className={`text-2xl font-black tracking-tight ${dk("text-white", "text-foreground")}`}>Cotizador Express</h2>
        <p className="text-sm text-muted-foreground mt-2">Pegue el texto o suba la cotización de su proveedor actual y encontraremos mejores opciones automáticamente.</p>
      </div>

      <div className={`p-8 rounded-[32px] border ${dk("bg-[#111] border-white/5", "bg-white border-black/5 shadow-xl")}`}>
        {!results ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Opción A: Pegar texto</label>
                <Textarea 
                  placeholder="Ej: 10x Monitor Dell 24' P2422H - $250.000..." 
                  className={`min-h-[200px] rounded-2xl ${dk("bg-black/50 border-white/10", "bg-gray-50/50 border-black/5")}`}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-1">Opción B: Subir Archivo (PDF/Excel)</label>
                <div className={`h-[200px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer ${dk("border-white/10 hover:border-primary/40 text-white/20", "border-black/5 hover:border-primary/40 text-black/20")}`}>
                  <Upload size={32} className="mb-4 text-primary opacity-50" />
                  <p className="text-xs font-bold text-muted-foreground">Arrastre su PDF aquí</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Soportamos formatos exportados de sistemas ERP</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleAnalyze} 
              disabled={analyzing || !inputText}
              className="w-full h-14 rounded-2xl bg-gradient-primary text-base font-bold shadow-lg shadow-primary/20 gap-2"
            >
              {analyzing ? (
                <>Analizando con IA...</>
              ) : (
                <>Comparar Oferta <Sparkles size={18} /></>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between gap-4">
               <div>
                 <h3 className="text-lg font-bold">Análisis Completado</h3>
                 <p className="text-xs text-muted-foreground">Hemos encontrado equivalencias para {results.filter(r => r.found).length} de {results.length} ítems.</p>
               </div>
               <Button variant="outline" size="sm" onClick={() => setResults(null)}>Nueva Comparativa</Button>
            </div>

            <div className="grid gap-3">
              {results.map((res, i) => (
                <div key={i} className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center gap-4 ${dk("bg-black border-white/5", "bg-gray-50 border-black/5")}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground font-mono mb-1 truncate">Origen: "{res.originalName}"</p>
                    {res.found ? (
                      <div className="flex items-center gap-2">
                         <CheckCircle2 size={14} className="text-primary shrink-0" />
                         <span className="text-xs font-bold truncate">{res.product?.name}</span>
                         <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Match</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground/50">
                         <AlertCircle size={14} />
                         <span className="text-xs">No encontramos coincidencia exacta</span>
                      </div>
                    )}
                  </div>

                  {res.found && res.product && (
                    <div className="flex items-center gap-6 w-full md:w-auto shrink-0 border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-6">
                       <div className="text-right">
                         <p className="text-[10px] text-muted-foreground">En Bartez</p>
                         <p className="text-sm font-black text-primary">{formatMoneyAmount(res.product.unit_price || 0, currency, 0)}</p>
                         <p className={`text-[10px] font-bold ${getAvailableStock(res.product) > 0 ? "text-[#2D9F6A]" : "text-red-400"}`}>
                           {getAvailableStock(res.product) > 0 ? `Stock: ${getAvailableStock(res.product)}` : "Sin stock"}
                         </p>
                       </div>
                       
                       <Button 
                         size="sm" 
                         disabled={getAvailableStock(res.product) === 0}
                         onClick={() => onAddToCart(res.product!, 1)}
                         className="h-8 rounded-lg bg-surface border border-white/10 hover:bg-[#1a1a1a] text-[10px] font-bold gap-1"
                       >
                         Sumar <ShoppingCart size={12} />
                       </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={`p-6 rounded-2xl border text-center ${dk("bg-primary/5 border-primary/20", "bg-primary/5 border-primary/20")}`}>
               <TrendingDown size={32} className="mx-auto mb-2 text-primary" />
               <p className="text-xs font-bold uppercase tracking-widest text-primary">Ahorro Estimado Total</p>
               <h4 className="text-2xl font-black text-white mt-1">8% - 12% Mensual</h4>
               <p className="text-[10px] text-muted-foreground mt-1 max-w-sm mx-auto">Basado en los precios públicos de mercado comparados con tu nivel de partner en Bartez.</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer support */}
      <div className={`flex items-center gap-4 p-5 rounded-2xl border ${dk("bg-[#111] border-white/5", "bg-white border-black/5")}`}>
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
          <Clipboard size={18} />
        </div>
        <div>
          <p className="text-xs font-bold">¿Tienes un Excel masivo?</p>
          <p className="text-[10px] text-muted-foreground">Envía tu archivo a licitaciones@bartez.com.ar y te respondemos en menos de 1 hora.</p>
        </div>
        <Button variant="link" className="ml-auto text-primary text-[10px] font-bold">Enviar por Mail <ArrowRight size={10} /></Button>
      </div>
    </div>
  );
}
