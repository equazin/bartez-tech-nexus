import { useMemo } from "react";
import {
  CreditCard, TrendingUp, AlertTriangle,
  Calendar, CheckCircle2, Download, Upload, Clock
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoneyInPreferredCurrency, getEffectiveInvoiceAmounts, convertMoneyAmount } from "@/lib/money";

interface Props {
  profile: any;
  invoices: any[];
  payments: any[];
  isDark: boolean;
  // formatPrice kept for backward compat but no longer used internally
  formatPrice?: (amt: number) => string;
}

export function DetailedAccountView({ profile, invoices, isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { currency, exchangeRate } = useCurrency();

  // Convert invoice amount to current display currency, respecting its stored currency
  const fmtInv = (inv: any) => {
    const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
    const converted = convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate);
    return formatMoneyInPreferredCurrency(converted, currency, currency, 1, 0);
  };

  // credit_limit and credit_used are stored in ARS
  const creditLimit = profile?.credit_limit ?? 0;
  const creditUsed  = profile?.credit_used  ?? 0;

  const totalDebt = useMemo(() =>
    invoices
      .filter(i => i.status !== "paid")
      .reduce((s, inv) => {
        const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
        return s + convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate);
      }, 0),
    [invoices, currency, exchangeRate.rate]
  );

  const overdueDebt = useMemo(() =>
    invoices
      .filter(i => i.status !== "paid" && i.due_date && new Date(i.due_date) < new Date())
      .reduce((s, inv) => {
        const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
        return s + convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate);
      }, 0),
    [invoices, currency, exchangeRate.rate]
  );

  const creditAvailable = creditLimit > 0
    ? Math.max(0, convertMoneyAmount(creditLimit - creditUsed, "ARS", currency, exchangeRate.rate))
    : 0;

  const fmtAmt = (n: number) => formatMoneyInPreferredCurrency(n, currency, currency, 1, 0);

  const nextDue = invoices
    .filter(i => i.status !== "paid" && i.due_date)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0]?.due_date;

  const kpis = [
    { label: "Saldo Total CC",     value: fmtAmt(totalDebt),     icon: CreditCard,    color: "text-blue-400"   },
    { label: "Deuda Vencida",      value: fmtAmt(overdueDebt),   icon: AlertTriangle, color: overdueDebt > 0 ? "text-red-400" : "text-gray-500" },
    { label: "Disponible Crédito", value: creditLimit > 0 ? fmtAmt(creditAvailable) : "Sin límite", icon: TrendingUp, color: "text-emerald-400" },
    { label: "Próximo Vencimiento",
      value: nextDue ? format(new Date(nextDue), "dd MMM", { locale: es }) : "---",
      icon: Calendar, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      {/* ── CC KPIs ── */}
      <div className="grid md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`p-4 rounded-2xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-gray-500/5 ${k.color}`}>
                <k.icon size={14} />
              </div>
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{k.label}</span>
            </div>
            <p className={`text-xl font-extrabold tabular-nums ${dk("text-white", "text-black")}`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Account movements ── */}
      <div className={`rounded-2xl border overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="px-6 py-4 border-b border-inherit flex items-center justify-between">
          <h3 className="text-sm font-bold">Estado de Cuenta Detallado</h3>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 text-xs text-[#2D9F6A] font-bold hover:underline">
              <Download size={12} /> Bajar Resumen
            </button>
            <button className="flex items-center gap-1.5 text-xs text-blue-400 font-bold hover:underline">
              <Upload size={12} /> Cargar E-Check
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-[10px] uppercase font-bold tracking-wider ${dk("bg-[#1a1a1a] text-[#737373]", "bg-[#f9f9f9] text-[#a3a3a3]")}`}>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Comprobante</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Vencimiento</th>
                <th className="px-6 py-3 text-right">Importe</th>
                <th className="px-6 py-3 text-right">Saldo Pend.</th>
              </tr>
            </thead>
            <tbody className={`text-xs divide-y ${dk("divide-[#1a1a1a]", "divide-[#eeeeee]")}`}>
              {invoices.map((inv) => (
                <tr key={inv.id} className={`${dk("hover:bg-[#141414]", "hover:bg-[#f9f9f9]")} transition-colors`}>
                  <td className="px-6 py-4 text-gray-500 font-mono">
                    {format(new Date(inv.created_at), "dd/MM/yy")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold">{inv.invoice_number || `FC #${inv.id.slice(-6)}`}</span>
                      <span className="text-[10px] text-gray-500 italic">Orden {inv.order_number || "#123"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      inv.status === "paid"
                        ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                        : inv.due_date && new Date(inv.due_date) < new Date()
                          ? "bg-red-400/10 text-red-400 border-red-400/20"
                          : "bg-amber-400/10 text-amber-400 border-amber-400/20"
                    }`}>
                      {inv.status === "paid" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {inv.status === "paid" ? "Pagado" : inv.due_date && new Date(inv.due_date) < new Date() ? "Vencido" : "Pendiente"}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-mono ${inv.status !== "paid" && inv.due_date && new Date(inv.due_date) < new Date() ? "text-red-400 font-bold" : ""}`}>
                    {inv.due_date ? format(new Date(inv.due_date), "dd/MM/yy") : "---"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold">{fmtInv(inv)}</td>
                  <td className="px-6 py-4 text-right font-bold text-gray-400">
                    {inv.status === "paid" ? "---" : fmtInv(inv)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
