import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock3,
  CreditCard,
  RefreshCw,
  RotateCcw,
  UserPlus,
} from "lucide-react";

import { listRegistrationRequests, type RegistrationRequestRecord } from "@/lib/api/registrationApi";
import { fetchInvoices, type Invoice } from "@/lib/api/invoices";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import { supabase } from "@/lib/supabase";

type ExceptionTabTarget =
  | "registration_requests"
  | "approvals"
  | "orders"
  | "credit"
  | "invoices"
  | "rma";

interface OrderRow {
  id: string | number;
  client_id: string;
  total: number;
  status: string;
  order_number?: string;
  created_at: string;
}

interface ClientRow {
  id: string;
  company_name?: string;
  contact_name?: string;
}

interface RmaQueueItem {
  id: string;
  rma_number: string;
  client_id: string;
  client_name?: string;
  status: string;
  created_at: string;
}

interface ExceptionInboxTabProps {
  isDark?: boolean;
  orders: OrderRow[];
  clients: ClientRow[];
  onOpenTab: (tab: ExceptionTabTarget) => void;
}

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const ACTIONABLE_RMA_STATUSES = new Set(["pending", "submitted", "reviewing", "approved"]);

const RMA_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  submitted: "Enviado",
  reviewing: "En revision",
  approved: "Aprobado",
};

function formatDate(value: string | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR");
}

function byCreatedAtDesc<T extends { created_at?: string }>(left: T, right: T) {
  const leftDate = new Date(left.created_at ?? "").getTime();
  const rightDate = new Date(right.created_at ?? "").getTime();
  return rightDate - leftDate;
}

export function ExceptionInboxTab({
  isDark = true,
  orders,
  clients,
  onOpenTab,
}: ExceptionInboxTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registrationQueue, setRegistrationQueue] = useState<RegistrationRequestRecord[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [rmaQueue, setRmaQueue] = useState<RmaQueueItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((client) => {
      const label = client.company_name || client.contact_name || client.id;
      map.set(client.id, label);
    });
    return map;
  }, [clients]);

  const orderQueue = useMemo(
    () =>
      orders
        .filter((order) => order.status === "pending" || order.status === "pending_approval")
        .sort((left, right) => byCreatedAtDesc(left, right)),
    [orders],
  );

  const criticalOrderQueue = useMemo(
    () => orderQueue.filter((order) => order.status === "pending_approval"),
    [orderQueue],
  );

  const invoiceQueue = useMemo(
    () =>
      [...overdueInvoices].sort(
        (left, right) =>
          new Date(left.due_date ?? left.created_at).getTime() -
          new Date(right.due_date ?? right.created_at).getTime(),
      ),
    [overdueInvoices],
  );

  const loadRmaQueue = useCallback(async (): Promise<RmaQueueItem[]> => {
    if (hasBackendUrl) {
      const { items } = await backend.rma.list({ limit: 80 });
      return items
        .filter((row) => ACTIONABLE_RMA_STATUSES.has(String(row.status)))
        .map((row) => ({
          id: String(row.id),
          rma_number: row.rma_number ?? `RMA-${String(row.id)}`,
          client_id: row.client_id,
          client_name: row.client_name ?? undefined,
          status: String(row.status),
          created_at: row.created_at,
        }))
        .sort(byCreatedAtDesc);
    }

    const { data, error } = await supabase
      .from("rma_requests")
      .select("id, rma_number, client_id, status, created_at")
      .in("status", Array.from(ACTIONABLE_RMA_STATUSES))
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) throw error;

    return ((data ?? []) as Array<{
      id: string | number;
      rma_number?: string | null;
      client_id: string;
      status: string;
      created_at: string;
    }>).map((row) => ({
      id: String(row.id),
      rma_number: row.rma_number ?? `RMA-${String(row.id)}`,
      client_id: row.client_id,
      status: row.status,
      created_at: row.created_at,
    }));
  }, []);

  const loadInbox = useCallback(async () => {
    setRefreshing(true);
    const nextWarnings: string[] = [];

    const [registrationResult, invoiceResult, rmaResult] = await Promise.allSettled([
      listRegistrationRequests("all"),
      fetchInvoices({ status: "overdue", limit: 80 }),
      loadRmaQueue(),
    ]);

    if (registrationResult.status === "fulfilled") {
      setRegistrationQueue(
        registrationResult.value
          .filter((request) => request.workflow_status === "pending_review")
          .sort((left, right) => byCreatedAtDesc(left, right)),
      );
    } else {
      nextWarnings.push("No se pudo cargar la cola de altas B2B.");
      setRegistrationQueue([]);
    }

    if (invoiceResult.status === "fulfilled") {
      setOverdueInvoices(invoiceResult.value);
    } else {
      nextWarnings.push("No se pudo cargar la cola de cobranzas.");
      setOverdueInvoices([]);
    }

    if (rmaResult.status === "fulfilled") {
      setRmaQueue(rmaResult.value);
    } else {
      nextWarnings.push("No se pudo cargar la cola de RMA.");
      setRmaQueue([]);
    }

    setWarnings(nextWarnings);
    setLoading(false);
    setRefreshing(false);
  }, [loadRmaQueue]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const totalExceptions =
    registrationQueue.length + orderQueue.length + invoiceQueue.length + rmaQueue.length;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>
            Bandeja de excepciones
          </h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Prioriza incidencias operativas en una vista unica para onboarding, pedidos, cobranzas y RMA.
          </p>
        </div>
        <button
          onClick={() => void loadInbox()}
          disabled={refreshing}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
            dk(
              "border-[#2a2a2a] text-[#a3a3a3] hover:bg-[#1a1a1a] hover:text-white",
              "border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5] hover:text-[#171717]",
            )
          }`}
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {warnings.length > 0 && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${dk(
            "border-amber-500/20 bg-amber-500/10 text-amber-300",
            "border-amber-200 bg-amber-50 text-amber-700",
          )}`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              {warnings.map((warning) => (
                <p key={warning} className="text-xs">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total excepciones", value: totalExceptions, icon: Clock3, accent: "text-amber-400" },
          { label: "Altas en revision", value: registrationQueue.length, icon: UserPlus, accent: "text-blue-400" },
          { label: "Pedidos por revisar", value: orderQueue.length, icon: ClipboardList, accent: "text-emerald-400" },
          { label: "Facturas vencidas", value: invoiceQueue.length, icon: CreditCard, accent: "text-red-400" },
          { label: "RMA abiertos", value: rmaQueue.length, icon: RotateCcw, accent: "text-indigo-400" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className={`rounded-xl border px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#737373]">{label}</p>
              <Icon size={13} className="text-[#737373]" />
            </div>
            <p className={`mt-2 text-2xl font-extrabold ${accent}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`rounded-2xl border p-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Altas B2B en revision</h3>
            <button
              onClick={() => onOpenTab("registration_requests")}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Abrir altas <ArrowRight size={12} />
            </button>
          </div>
          {loading ? (
            <p className="text-xs text-[#737373] py-5">Cargando...</p>
          ) : registrationQueue.length === 0 ? (
            <p className="text-xs text-[#737373] py-5">No hay solicitudes pendientes de revision manual.</p>
          ) : (
            <div className="space-y-2">
              {registrationQueue.slice(0, 6).map((request) => (
                <div key={request.id} className={`rounded-xl border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                  <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>
                    {request.company_name || request.contact_name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#737373]">
                    {request.email} - {request.cuit}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#737373]">
                    {formatDate(request.created_at)} - Flags: {request.review_flags.length}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Pedidos para decision</h3>
            <button
              onClick={() => onOpenTab("approvals")}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Abrir aprobaciones <ArrowRight size={12} />
            </button>
          </div>
          {orderQueue.length === 0 ? (
            <p className="text-xs text-[#737373] py-5">No hay pedidos en estado pendiente.</p>
          ) : (
            <div className="space-y-2">
              {orderQueue.slice(0, 6).map((order) => (
                <div key={String(order.id)} className={`rounded-xl border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>
                      {order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`}
                    </p>
                    <span className="text-[11px] font-semibold text-emerald-500">{ARS.format(order.total)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#737373]">
                    {clientNameById.get(order.client_id) ?? order.client_id}
                  </p>
                  {order.status === "pending_approval" && (
                    <span className="mt-1 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      Escalado por umbral de aprobacion
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {criticalOrderQueue.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-400">
              {criticalOrderQueue.length} pedido(s) con aprobacion corporativa pendiente.
            </p>
          )}
        </section>

        <section className={`rounded-2xl border p-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Cobranzas vencidas</h3>
            <button
              onClick={() => onOpenTab("invoices")}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Abrir facturas <ArrowRight size={12} />
            </button>
          </div>
          {invoiceQueue.length === 0 ? (
            <p className="text-xs text-[#737373] py-5">No hay facturas vencidas.</p>
          ) : (
            <div className="space-y-2">
              {invoiceQueue.slice(0, 6).map((invoice) => (
                <div key={invoice.id} className={`rounded-xl border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{invoice.invoice_number}</p>
                    <span className="text-[11px] font-semibold text-red-400">{ARS.format(invoice.total)}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#737373]">
                    {clientNameById.get(invoice.client_id) ?? invoice.client_id}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#737373]">Vence: {formatDate(invoice.due_date)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`rounded-2xl border p-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>RMA en curso</h3>
            <button
              onClick={() => onOpenTab("rma")}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Abrir RMA <ArrowRight size={12} />
            </button>
          </div>
          {rmaQueue.length === 0 ? (
            <p className="text-xs text-[#737373] py-5">No hay RMA en estados accionables.</p>
          ) : (
            <div className="space-y-2">
              {rmaQueue.slice(0, 6).map((rma) => (
                <div key={rma.id} className={`rounded-xl border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#ececec] bg-[#fafafa]")}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>{rma.rma_number}</p>
                    <span className="text-[10px] rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-400 font-semibold">
                      {RMA_STATUS_LABELS[rma.status] ?? rma.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#737373]">
                    {rma.client_name ?? clientNameById.get(rma.client_id) ?? rma.client_id}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#737373]">{formatDate(rma.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

