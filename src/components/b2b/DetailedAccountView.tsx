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
  formatPrice?: (amt: number) => string;
}

export function DetailedAccountView({ profile, invoices, isDark: _isDark }: Props) {
  const { currency, exchangeRate } = useCurrency();

  const fmtInv = (inv: any) => {
    const eff = getEffectiveInvoiceAmounts(inv, exchangeRate.rate);
    const converted = convertMoneyAmount(eff.total, eff.currency, currency, exchangeRate.rate);
    return formatMoneyInPreferredCurrency(converted, currency, currency, 1, 0);
  };

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
    { label: "Saldo Total CC",      value: fmtAmt(totalDebt),     icon: CreditCard,    color: "text-blue-600 dark:text-blue-400" },
    { label: "Deuda Vencida",       value: fmtAmt(overdueDebt),   icon: AlertTriangle, color: overdueDebt > 0 ? "text-destructive" : "text-muted-foreground" },
    { label: "Disponible Crédito",  value: creditLimit > 0 ? fmtAmt(creditAvailable) : "Sin límite", icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Próximo Vencimiento", value: nextDue ? format(new Date(nextDue), "dd MMM", { locale: es }) : "---", icon: Calendar, color: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="border border-border/70 bg-card rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-secondary ${k.color}`}>
                <k.icon size={14} />
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{k.label}</span>
            </div>
            <p className={`text-xl font-extrabold tabular-nums text-foreground`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-border/70 bg-card rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border/70 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Estado de Cuenta Detallado</h3>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
              <Download size={12} /> Bajar Resumen
            </button>
            <button className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline">
              <Upload size={12} /> Cargar E-Check
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase font-bold tracking-wider bg-secondary text-muted-foreground">
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Comprobante</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Vencimiento</th>
                <th className="px-6 py-3 text-right">Importe</th>
                <th className="px-6 py-3 text-right">Saldo Pend.</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-border/70">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground font-mono">
                    {format(new Date(inv.created_at), "dd/MM/yy")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground">{inv.invoice_number || `FC #${inv.id.slice(-6)}`}</span>
                      <span className="text-[10px] text-muted-foreground italic">Orden {inv.order_number || "#123"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      inv.status === "paid"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : inv.due_date && new Date(inv.due_date) < new Date()
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    }`}>
                      {inv.status === "paid" ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {inv.status === "paid" ? "Pagado" : inv.due_date && new Date(inv.due_date) < new Date() ? "Vencido" : "Pendiente"}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-mono ${inv.status !== "paid" && inv.due_date && new Date(inv.due_date) < new Date() ? "text-destructive font-bold" : "text-foreground"}`}>
                    {inv.due_date ? format(new Date(inv.due_date), "dd/MM/yy") : "---"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-foreground">{fmtInv(inv)}</td>
                  <td className="px-6 py-4 text-right font-bold text-muted-foreground">
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
