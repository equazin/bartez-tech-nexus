import { useEffect, useState } from "react";
import { 
  Ticket, 
  Plus, 
  Trash2, 
  Calendar, 
  Percent, 
  DollarSign, 
  Users, 
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase: number;
  max_uses?: number;
  used_count: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

interface MarketingTabProps {
  isDark?: boolean;
}

export function MarketingTab({ isDark = true }: MarketingTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // New coupon state
  const [code, setCode] = useState("");
  const [type, setType] = useState<'percentage' | 'fixed'>("percentage");
  const [value, setValue] = useState(0);
  const [minPurchase, setMinPurchase] = useState(0);
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) setCoupons(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || value <= 0) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        code: code.trim().toUpperCase(),
        discount_type: type,
        discount_value: value,
        min_purchase: minPurchase,
        max_uses: maxUses ? parseInt(maxUses) : null,
        expires_at: expiresAt || null,
        is_active: true
      });

      if (!error) {
        setShowForm(false);
        fetchCoupons();
        // Reset form
        setCode("");
        setValue(0);
        setMinPurchase(0);
        setMaxUses("");
        setExpiresAt("");
      }
    } catch (err) {
      console.error("Error creating coupon:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cupón permanentemente?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${dk("text-white", "text-gray-900")}`}>Marketing y Fidelización</h2>
          <p className={`text-sm ${dk("text-gray-400", "text-gray-500")}`}>Gestión de cupones y promociones para clientes B2B.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] text-white px-4 py-2 rounded-lg text-sm font-bold transition shadow-lg shadow-[#2D9F6A]/20"
        >
          {showForm ? "Cancelar" : <><Plus size={16} /> Nuevo Cupón</>}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          icon={<Ticket className="text-blue-400" size={18} />}
          label="Cupones Activos"
          value={coupons.filter(c => c.is_active).length.toString()}
          isDark={isDark}
        />
        <StatCard 
          icon={<Activity className="text-green-400" size={18} />}
          label="Usos Totales"
          value={coupons.reduce((acc, curr) => acc + curr.used_count, 0).toString()}
          isDark={isDark}
        />
        <StatCard 
          icon={<Users className="text-purple-400" size={18} />}
          label="Conversión"
          value="-- %"
          isDark={isDark}
        />
        <StatCard 
          icon={<AlertCircle className="text-amber-400" size={18} />}
          label="Por Expirar"
          value={coupons.filter(c => c.expires_at && new Date(c.expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length.toString()}
          isDark={isDark}
        />
      </div>

      {/* Formulario de Creación */}
      {showForm && (
        <div className={`p-6 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-gray-200")} animate-in slide-in-from-top duration-300`}>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Código del Cupón</label>
              <input 
                value={code} 
                onChange={e => setCode(e.target.value)}
                placeholder="EJ: BARTEZ2026"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-mono outline-none focus:border-[#2D9F6A] transition ${dk("bg-[#111] border-[#222] text-white", "bg-gray-50 border-gray-200 text-gray-900")}`}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Tipo de Descuento</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value as any)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[#2D9F6A] transition ${dk("bg-[#111] border-[#222] text-white", "bg-gray-50 border-gray-200 text-gray-900")}`}
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Valor del Descuento</label>
              <div className="relative">
                <input 
                  type="number"
                  value={value}
                  onChange={e => setValue(parseFloat(e.target.value))}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[#2D9F6A] transition ${dk("bg-[#111] border-[#222] text-white", "bg-gray-50 border-gray-200 text-gray-900")}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {type === 'percentage' ? <Percent size={14} /> : <DollarSign size={14} />}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Compra Mínima (USD)</label>
              <input 
                type="number"
                value={minPurchase}
                onChange={e => setMinPurchase(parseFloat(e.target.value))}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[#2D9F6A] transition ${dk("bg-[#111] border-[#222] text-white", "bg-gray-50 border-gray-200 text-gray-900")}`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Límite de Usos (Opcional)</label>
              <input 
                type="number"
                value={maxUses}
                onChange={e => setMaxUses(e.target.value)}
                placeholder="Sin límite"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[#2D9F6A] transition ${dk("bg-[#111] border-[#222] text-white", "bg-gray-50 border-gray-200 text-gray-900")}`}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Expiración (Opcional)</label>
              <input 
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[#2D9F6A] transition ${dk("bg-[#111] border-[#222] text-white", "bg-gray-50 border-gray-200 text-gray-900")}`}
              />
            </div>

            <div className="md:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#2D9F6A] hover:bg-[#25835A] text-white px-8 py-2.5 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                {isSaving ? "Guardando..." : "Crear Cupón Proporcional"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Cupones */}
      <div className={`rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-gray-200")} overflow-hidden`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`border-b ${dk("border-[#1a1a1a] bg-[#111]", "border-gray-100 bg-gray-50")}`}>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Cupón</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Descuento</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Condiciones</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">Uso</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">Estado</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100/10">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">Cargando cupones...</td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">No hay cupones creados aún.</td>
              </tr>
            ) : coupons.map(coupon => (
              <tr key={coupon.id} className={`${dk("hover:bg-[#111]", "hover:bg-gray-50")} transition`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${dk("bg-[#2D9F6A]/10 text-[#2D9F6A]", "bg-[#2D9F6A]/5 text-[#2D9F6A]")}`}>
                      <Ticket size={16} />
                    </div>
                    <span className={`font-mono font-bold text-sm ${dk("text-white", "text-gray-900")}`}>{coupon.code}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`font-bold ${dk("text-white", "text-gray-900")}`}>
                    {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `USD ${coupon.discount_value}`}
                  </span>
                  <p className="text-[10px] text-gray-500">{coupon.discount_type === 'percentage' ? 'De descuento' : 'Monto fijo'}</p>
                </td>
                <td className="px-6 py-4 text-xs">
                  <div className="space-y-1">
                    <p className={dk("text-gray-300", "text-gray-600")}>Min: <b>USD {coupon.min_purchase}</b></p>
                    {coupon.expires_at && (
                      <p className="text-gray-500 flex items-center gap-1"><Calendar size={10} /> Exp: {new Date(coupon.expires_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="space-y-1">
                    <span className={`text-xs font-bold ${dk("text-white", "text-gray-900")}`}>{coupon.used_count}</span>
                    {coupon.max_uses && <span className="text-[10px] text-gray-500 block">de {coupon.max_uses}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <button 
                      onClick={() => toggleActive(coupon.id, coupon.is_active)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition ${
                        coupon.is_active 
                        ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                      }`}
                    >
                      {coupon.is_active ? <><CheckCircle2 size={10} /> Activo</> : <><XCircle size={10} /> Inactivo</>}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleDelete(coupon.id)}
                    className="p-2 text-gray-500 hover:text-red-500 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, isDark }: { icon: any, label: string, value: string, isDark: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  return (
    <div className={`p-4 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-gray-100")}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${dk("text-white", "text-gray-900")}`}>{value}</p>
    </div>
  );
}
