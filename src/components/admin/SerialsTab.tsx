import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, Package, Calendar, User, FileText, 
  CheckCircle2, ShieldCheck, AlertTriangle, History 
} from "lucide-react";

interface Props { isDark?: boolean }

interface SerialRecord {
  id: string;
  serial_number: string;
  product_id: number;
  products: { name: string; sku: string };
  status: 'available' | 'sold' | 'rma' | 'scrap';
  sold_at: string | null;
  warranty_until: string | null;
  client_id: string | null;
  profiles: { company_name: string; contact_name: string } | null;
  order_id: string | null;
  invoice_id: string | null;
  created_at: string;
}

export function SerialsTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SerialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, sold: 0, available: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const { data } = await supabase.from("product_serials").select("status");
    if (!data) return;
    setStats({
      total: data.length,
      sold: data.filter(d => d.status === 'sold').length,
      available: data.filter(d => d.status === 'available').length,
    });
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("product_serials")
      .select("*, products(name, sku), profiles(company_name, contact_name)")
      .ilike("serial_number", `%${searchQuery}%`)
      .order("created_at", { ascending: false });

    if (data) setResults(data as any);
    setLoading(false);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'sold':      return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'rma':       return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default:          return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Trazabilidad de Números de Serie</h2>
        <p className="text-xs text-gray-500 mt-0.5">Consulta de garantías, RMA y trazabilidad por cliente.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Registrados", value: stats.total, icon: Package, color: "text-blue-400" },
          { label: "Vendidos / En Uso", value: stats.sold, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Stock Disponible", value: stats.available, icon: ShieldCheck, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className={`p-4 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center bg-gray-500/5 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono">{s.label}</p>
                <p className={`text-xl font-extrabold ${dk("text-white", "text-black")}`}>{s.value.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className={`p-4 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ingresar número de serie (S/N)..."
              className={`w-full pl-9 pr-4 py-2 text-sm border rounded-xl outline-none transition ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#fafafa] border-[#e5e5e5] text-black focus:border-[#2D9F6A]")}`}
            />
          </div>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white rounded-xl font-bold text-xs transition disabled:opacity-50"
          >
            {loading ? "Buscando..." : "Consultar"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {results.length > 0 ? results.map((r) => {
          const isExpired = r.warranty_until && new Date(r.warranty_until) < new Date();
          return (
            <div key={r.id} className={`p-5 rounded-2xl border animate-in fade-in slide-in-from-bottom-2 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-2xl border flex items-center justify-center ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
                    <History size={20} className="text-[#2D9F6A]" />
                  </div>
                  <div>
                    <p className={`text-lg font-extrabold font-mono tracking-tighter ${dk("text-white", "text-black")}`}>{r.serial_number}</p>
                    <p className="text-xs text-gray-500 font-bold">{r.products.name} · SKU: {r.products.sku}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(r.status)}`}>
                  {r.status === 'sold' ? 'Vendido' : r.status === 'available' ? 'En Stock' : r.status}
                </span>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Sale info */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User size={14} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Cliente / Comprador</p>
                      <p className="text-xs font-bold">{r.profiles?.company_name || r.profiles?.contact_name || "---"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText size={14} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Documentos</p>
                      <p className="text-xs font-mono">{r.invoice_id ? `Factura: ${String(r.invoice_id).slice(-8)}` : "Sin factura"}</p>
                    </div>
                  </div>
                </div>

                {/* Dates info */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar size={14} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Fecha de Venta</p>
                      <p className="text-xs font-bold">{r.sold_at ? new Date(r.sold_at).toLocaleDateString() : "---"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <History size={14} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Ingreso Sistema</p>
                      <p className="text-xs font-bold">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Warranty info */}
                <div className={`p-4 rounded-xl border ${isExpired ? 'bg-red-400/5 border-red-400/10' : 'bg-emerald-400/5 border-emerald-400/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={14} className={isExpired ? 'text-red-400' : 'text-emerald-400'} />
                    <span className={`text-[10px] font-bold uppercase ${isExpired ? 'text-red-400' : 'text-emerald-400'}`}>Garantía</span>
                  </div>
                  {r.warranty_until ? (
                    <>
                      <p className={`text-sm font-bold ${isExpired ? 'text-red-400 line-through' : 'text-emerald-400'}`}>
                        Vence: {new Date(r.warranty_until).toLocaleDateString()}
                      </p>
                      {isExpired && (
                        <div className="flex items-center gap-1.5 mt-1 text-red-500">
                          <AlertTriangle size={10} />
                          <span className="text-[9px] font-bold uppercase">Garantía Vencida</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 italic">No especificada</p>
                  )}
                </div>
              </div>
            </div>
          );
        }) : searchQuery && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <AlertTriangle size={32} className="mb-2" />
            <p className="text-xs font-bold">Número de serie no encontrado o inválido.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
