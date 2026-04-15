import { useCallback, useEffect, useMemo, useState } from "react";
import { CLIENT_TYPE_MARGINS, type ClientType, supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import type { QuoteStatus } from "@/models/quote";

interface Props {
  isDark?: boolean;
}

interface QuoteItemRow {
  id?: number | string;
  name?: string;
  product_name?: string;
  quantity?: number;
  totalWithIVA?: number;
  total_price?: number;
}

interface AdminQuote {
  id: number;
  client_id: string;
  client_name: string;
  items: QuoteItemRow[];
  subtotal: number;
  iva_total: number;
  total: number;
  currency: "USD" | "ARS";
  status: QuoteStatus;
  version: number;
  expires_at: string | null;
  converted_to_order_id: number | null;
  created_at: string;
  company_name?: string;
  contact_name?: string;
  client_email?: string;
}

interface ExpressClientRow {
  id: string;
  company_name?: string | null;
  contact_name?: string | null;
  default_margin?: number | null;
  client_type?: ClientType | null;
  role?: string | null;
}

interface ExpressProductRow {
  id: number;
  name: string;
  sku?: string | null;
  external_id?: string | null;
  cost_price?: number | null;
  iva_rate?: number | null;
  special_price?: number | null;
  stock?: number | null;
}

interface ParsedBulkEntry {
  raw: string;
  lineNumber: number;
  reference: string;
  quantity: number;
}

interface ParsedBulkInvalid {
  raw: string;
  lineNumber: number;
  reason: string;
}

interface ProductLookup {
  byExact: Map<string, ExpressProductRow>;
  byCompact: Map<string, ExpressProductRow>;
}

interface BulkAnalysis {
  parsedEntries: ParsedBulkEntry[];
  invalidLines: ParsedBulkInvalid[];
  missingEntries: ParsedBulkEntry[];
  consolidated: Array<{ product: ExpressProductRow; quantity: number }>;
}

type StatusConfig = {
  label: string;
  icon: typeof FileText;
  className: string;
};

const STATUS_CONFIG: Record<QuoteStatus, StatusConfig> = {
  draft: { label: "Borrador", icon: FileText, className: "bg-muted text-muted-foreground" },
  sent: { label: "Enviada", icon: Send, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  viewed: { label: "Vista", icon: Eye, className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  approved: { label: "Aprobada", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  rejected: { label: "Rechazada", icon: XCircle, className: "bg-red-500/10 text-red-600 dark:text-red-400" },
  converted: { label: "Convertida", icon: ArrowRight, className: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  expired: { label: "Vencida", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

function compactLookupKey(value: string) {
  return normalizeLookupKey(value).replace(/[^a-z0-9]/g, "");
}

function buildProductLookup(products: ExpressProductRow[]): ProductLookup {
  const byExact = new Map<string, ExpressProductRow>();
  const byCompact = new Map<string, ExpressProductRow>();

  products.forEach((product) => {
    const rawKeys = [product.sku, product.external_id, String(product.id)].filter(Boolean) as string[];
    rawKeys.forEach((key) => {
      const exact = normalizeLookupKey(key);
      const compact = compactLookupKey(key);
      if (exact && !byExact.has(exact)) byExact.set(exact, product);
      if (compact && !byCompact.has(compact)) byCompact.set(compact, product);
    });
  });

  return { byExact, byCompact };
}

function parseBulkEntry(rawLine: string, lineNumber: number): ParsedBulkEntry | ParsedBulkInvalid | null {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  let reference = trimmed;
  let quantity = 1;

  const delimMatch = trimmed.match(/^(.+?)[;,]\s*(\d+)$/);
  const timesMatch = trimmed.match(/^(.+?)\s*[xX]\s*(\d+)$/);
  const spacedMatch = trimmed.match(/^(.+?)\s+(\d+)$/);

  if (delimMatch) {
    reference = delimMatch[1].trim();
    quantity = Number(delimMatch[2]);
  } else if (timesMatch) {
    reference = timesMatch[1].trim();
    quantity = Number(timesMatch[2]);
  } else if (spacedMatch) {
    reference = spacedMatch[1].trim();
    quantity = Number(spacedMatch[2]);
  }

  if (!reference) {
    return { raw: rawLine, lineNumber, reason: "Referencia vacia." };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { raw: rawLine, lineNumber, reason: "Cantidad invalida." };
  }

  return { raw: rawLine, lineNumber, reference, quantity };
}

function analyzeBulkInput(rawInput: string, lookup: ProductLookup): BulkAnalysis {
  const parsedEntries: ParsedBulkEntry[] = [];
  const invalidLines: ParsedBulkInvalid[] = [];
  const missingEntries: ParsedBulkEntry[] = [];
  const consolidatedMap = new Map<number, { product: ExpressProductRow; quantity: number }>();

  rawInput
    .split(/\r?\n/)
    .forEach((line, index) => {
      const parsed = parseBulkEntry(line, index + 1);
      if (!parsed) return;
      if ("reason" in parsed) {
        invalidLines.push(parsed);
        return;
      }

      parsedEntries.push(parsed);
      const exact = lookup.byExact.get(normalizeLookupKey(parsed.reference));
      const compact = lookup.byCompact.get(compactLookupKey(parsed.reference));
      const product = exact ?? compact;

      if (!product) {
        missingEntries.push(parsed);
        return;
      }

      const current = consolidatedMap.get(product.id);
      if (current) {
        current.quantity += parsed.quantity;
      } else {
        consolidatedMap.set(product.id, { product, quantity: parsed.quantity });
      }
    });

  return {
    parsedEntries,
    invalidLines,
    missingEntries,
    consolidated: Array.from(consolidatedMap.values()).sort((left, right) =>
      left.product.name.localeCompare(right.product.name, "es-AR"),
    ),
  };
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1 border-border/70 text-[11px] font-semibold", config.className)}>
      <Icon size={10} />
      {config.label}
    </Badge>
  );
}

export function QuotesAdminTab({ isDark: _isDark = true }: Props) {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [converting, setConverting] = useState<number | null>(null);
  const [convertError, setConvertError] = useState<Record<number, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [showExpressForm, setShowExpressForm] = useState(false);
  const [expressClients, setExpressClients] = useState<ExpressClientRow[]>([]);
  const [expressProducts, setExpressProducts] = useState<ExpressProductRow[]>([]);
  const [loadingExpressData, setLoadingExpressData] = useState(false);
  const [expressClientId, setExpressClientId] = useState("");
  const [expressStatus, setExpressStatus] = useState<"draft" | "sent">("draft");
  const [expressCurrency, setExpressCurrency] = useState<"USD" | "ARS">("USD");
  const [expressValidDays, setExpressValidDays] = useState("7");
  const [expressNotes, setExpressNotes] = useState("");
  const [expressBulkInput, setExpressBulkInput] = useState("");
  const [creatingExpress, setCreatingExpress] = useState(false);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [expressSuccess, setExpressSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("quotes")
      .select("*, profiles(company_name, contact_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    if (filterClient !== "all") {
      query = query.eq("client_id", filterClient);
    }

    const { data } = await query;

    setQuotes(
      ((data ?? []) as Array<AdminQuote & { profiles?: { company_name?: string; contact_name?: string; email?: string } | null }>).map((quote) => ({
        ...quote,
        iva_total: quote.iva_total ?? 0,
        items: Array.isArray(quote.items) ? quote.items : [],
        company_name: quote.profiles?.company_name,
        contact_name: quote.profiles?.contact_name,
        client_email: quote.profiles?.email,
      })),
    );

    setLoading(false);
  }, [filterClient, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadExpressData = useCallback(async () => {
    setLoadingExpressData(true);
    const [clientsResult, productsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, company_name, contact_name, default_margin, client_type, role")
        .not("role", "eq", "admin")
        .not("role", "eq", "vendedor")
        .not("role", "eq", "sales")
        .order("company_name", { ascending: true }),
      supabase
        .from("products")
        .select("id, name, sku, external_id, cost_price, iva_rate, special_price, stock")
        .eq("active", true)
        .order("name", { ascending: true })
        .limit(5000),
    ]);

    if (!clientsResult.error) {
      setExpressClients((clientsResult.data as ExpressClientRow[] | null) ?? []);
    }

    if (!productsResult.error) {
      setExpressProducts((productsResult.data as ExpressProductRow[] | null) ?? []);
    }

    setLoadingExpressData(false);
  }, []);

  useEffect(() => {
    void loadExpressData();
  }, [loadExpressData]);

  const uniqueClients = useMemo(
    () =>
      Array.from(new Map(quotes.map((quote) => [quote.client_id, quote.company_name || quote.contact_name || quote.client_id])).entries()),
    [quotes],
  );

  const selectedExpressClient = useMemo(
    () => expressClients.find((client) => client.id === expressClientId) ?? null,
    [expressClientId, expressClients],
  );

  const expressMargin = useMemo(() => {
    if (!selectedExpressClient) return 0;
    const byProfile = Number(selectedExpressClient.default_margin ?? NaN);
    if (Number.isFinite(byProfile)) return byProfile;
    const byType = selectedExpressClient.client_type ? CLIENT_TYPE_MARGINS[selectedExpressClient.client_type] : 0;
    return Number(byType ?? 0);
  }, [selectedExpressClient]);

  const productLookup = useMemo(() => buildProductLookup(expressProducts), [expressProducts]);

  const expressAnalysis = useMemo(
    () => analyzeBulkInput(expressBulkInput, productLookup),
    [expressBulkInput, productLookup],
  );

  const expressPreviewTotals = useMemo(() => {
    const lines = expressAnalysis.consolidated.map(({ product, quantity }) => {
      const cost = Number(product.cost_price ?? 0);
      const ivaRate = Number(product.iva_rate ?? 21);
      const unitPrice =
        product.special_price != null
          ? Number(product.special_price)
          : Number((cost * (1 + expressMargin / 100)).toFixed(2));
      const totalPrice = unitPrice * quantity;
      const ivaAmount = totalPrice * (ivaRate / 100);
      return { totalPrice, ivaAmount };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.totalPrice, 0);
    const ivaTotal = lines.reduce((sum, line) => sum + line.ivaAmount, 0);

    return {
      subtotal,
      ivaTotal,
      total: subtotal + ivaTotal,
      units: expressAnalysis.consolidated.reduce((sum, line) => sum + line.quantity, 0),
    };
  }, [expressAnalysis.consolidated, expressMargin]);

  const statusCounts = useMemo(
    () =>
      quotes.reduce<Record<string, number>>((accumulator, quote) => {
        accumulator[quote.status] = (accumulator[quote.status] ?? 0) + 1;
        return accumulator;
      }, {}),
    [quotes],
  );

  async function convertToOrder(quote: AdminQuote) {
    setConverting(quote.id);
    setConvertError((prev) => ({ ...prev, [quote.id]: "" }));

    const { error } = await supabase.rpc("convert_quote_to_order", {
      p_quote_id: String(quote.id),
      p_client_id: quote.client_id,
    });

    if (error) {
      setConvertError((prev) => ({ ...prev, [quote.id]: error.message }));
    } else {
      await load();
    }

    setConverting(null);
  }

  async function updateStatus(quoteId: number, status: QuoteStatus) {
    setUpdatingStatus(quoteId);

    await supabase.from("quotes").update({ status }).eq("id", quoteId);

    setQuotes((prev) => prev.map((quote) => (quote.id === quoteId ? { ...quote, status } : quote)));
    setUpdatingStatus(null);

    if (status === "approved" || status === "rejected") {
      const quote = quotes.find((item) => item.id === quoteId);

      if (quote?.client_email) {
        void fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: status === "approved" ? "quote_approved" : "quote_rejected",
            orderNumber: `COT-${quoteId}`,
            quoteId,
            clientId: quote.client_id,
            clientEmail: quote.client_email,
            clientName: quote.company_name || quote.contact_name || quote.client_name,
            products: [],
            total: quote.total,
          }),
        }).catch(() => {
          // Non-critical notification failure.
        });
      }
    }
  }

  async function createExpressQuote() {
    setExpressError(null);
    setExpressSuccess(null);

    if (!expressClientId) {
      setExpressError("Selecciona un cliente para crear la cotizacion.");
      return;
    }

    if (expressAnalysis.consolidated.length === 0) {
      setExpressError("No hay lineas validas para cotizar.");
      return;
    }

    if (expressAnalysis.invalidLines.length > 0 || expressAnalysis.missingEntries.length > 0) {
      setExpressError("Corrige lineas invalidas o referencias sin match antes de crear.");
      return;
    }

    if (!selectedExpressClient) {
      setExpressError("No se pudo resolver el cliente seleccionado.");
      return;
    }

    setCreatingExpress(true);

    const validDays = Math.max(1, Number.parseInt(expressValidDays || "7", 10) || 7);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000).toISOString();
    const clientName =
      selectedExpressClient.company_name ||
      selectedExpressClient.contact_name ||
      selectedExpressClient.id;

    const quoteLines = expressAnalysis.consolidated.map(({ product, quantity }) => {
      const cost = Number(product.cost_price ?? 0);
      const ivaRate = Number(product.iva_rate ?? 21);
      const unitPrice =
        product.special_price != null
          ? Number(product.special_price)
          : Number((cost * (1 + expressMargin / 100)).toFixed(2));
      const totalPrice = Number((unitPrice * quantity).toFixed(2));
      const ivaAmount = Number((totalPrice * (ivaRate / 100)).toFixed(2));
      const margin = cost > 0 ? Number((((unitPrice - cost) / cost) * 100).toFixed(2)) : expressMargin;

      return {
        product_id: product.id,
        name: product.name,
        quantity,
        cost,
        margin,
        unitPrice,
        totalPrice,
        ivaRate,
        ivaAmount,
        totalWithIVA: Number((totalPrice + ivaAmount).toFixed(2)),
      };
    });

    const subtotal = Number(quoteLines.reduce((sum, line) => sum + line.totalPrice, 0).toFixed(2));
    const ivaTotal = Number(quoteLines.reduce((sum, line) => sum + line.ivaAmount, 0).toFixed(2));
    const total = Number((subtotal + ivaTotal).toFixed(2));

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        client_id: expressClientId,
        client_name: clientName,
        items: quoteLines,
        subtotal,
        iva_total: ivaTotal,
        total,
        currency: expressCurrency,
        status: expressStatus,
        version: 1,
        valid_days: validDays,
        expires_at: expiresAt,
        notes: expressNotes.trim() || null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      setExpressError(error.message);
      setCreatingExpress(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({
        last_contact_at: now.toISOString(),
        last_contact_type: "cotizacion",
      })
      .eq("id", expressClientId);

    const createdId = Number((data as { id: number } | null)?.id);
    setExpressSuccess(
      `Cotizacion ${Number.isFinite(createdId) ? `COT-${String(createdId).padStart(5, "0")}` : "creada"} con ${quoteLines.length} item(s).`,
    );
    setExpressBulkInput("");
    setExpressNotes("");
    setFilterClient(expressClientId);
    setFilterStatus("all");
    await load();
    if (Number.isFinite(createdId)) setExpandedId(createdId);
    setCreatingExpress(false);
  }

  const formatMoney = (amount: number, currency: "USD" | "ARS") =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  const isExpired = (quote: AdminQuote) => (quote.expires_at ? new Date(quote.expires_at) < new Date() : false);

  return (
    <div className="space-y-4">
      <SurfaceCard tone="default" padding="md" className="rounded-[24px] border-border/70">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Ventas</p>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Cotizaciones</h2>
              <p className="text-sm text-muted-foreground">{quotes.length} cotizaciones administradas desde ventas.</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[180px_220px_auto]">
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
            >
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                <option key={status} value={status}>
                  {config.label}
                  {statusCounts[status] ? ` (${statusCounts[status]})` : ""}
                </option>
              ))}
            </select>

            <select
              value={filterClient}
              onChange={(event) => setFilterClient(event.target.value)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
            >
              <option value="all">Todos los clientes</option>
              {uniqueClients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <Button variant="toolbar" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void load()}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG)
            .filter(([status]) => statusCounts[status])
            .map(([status, config]) => {
              const Icon = config.icon;
              const isActive = filterStatus === status;

              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(isActive ? "all" : status)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                    isActive
                      ? cn("border-primary/40 shadow-sm shadow-primary/10", config.className)
                      : "border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  <Icon size={10} />
                  {config.label} ({statusCounts[status]})
                </button>
              );
            })}
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Operacion rapida</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Cotizacion express por lote</p>
              <p className="text-xs text-muted-foreground">
                Pegar lineas con formato `SKU cantidad` o `SKU;cantidad` para crear una cotizacion en segundos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="toolbar" size="sm" onClick={() => setShowExpressForm((prev) => !prev)}>
                {showExpressForm ? "Ocultar" : "Nueva express"}
              </Button>
              <Button variant="toolbar" size="icon" className="h-8 w-8 rounded-lg" onClick={() => void loadExpressData()}>
                <RefreshCw size={12} className={loadingExpressData ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {showExpressForm ? (
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 md:grid-cols-[1.6fr_0.8fr_0.8fr_0.7fr]">
                <select
                  value={expressClientId}
                  onChange={(event) => setExpressClientId(event.target.value)}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                >
                  <option value="">Seleccionar cliente...</option>
                  {expressClients.map((client) => {
                    const label = client.company_name || client.contact_name || client.id;
                    return (
                      <option key={client.id} value={client.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={expressStatus}
                  onChange={(event) => setExpressStatus(event.target.value as "draft" | "sent")}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                >
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviada</option>
                </select>

                <select
                  value={expressCurrency}
                  onChange={(event) => setExpressCurrency(event.target.value as "USD" | "ARS")}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                >
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>

                <input
                  value={expressValidDays}
                  onChange={(event) => setExpressValidDays(event.target.value.replace(/\D/g, ""))}
                  placeholder="Validez"
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                />
              </div>

              <textarea
                value={expressBulkInput}
                onChange={(event) => setExpressBulkInput(event.target.value)}
                rows={7}
                placeholder={"SKU-001 3\nSKU-ABC;5\n000123,2\n# lineas con # se ignoran"}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/40"
              />

              <input
                value={expressNotes}
                onChange={(event) => setExpressNotes(event.target.value)}
                placeholder="Notas comerciales opcionales..."
                className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
              />

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lineas parseadas</p>
                  <p className="text-lg font-bold text-foreground">{expressAnalysis.parsedEntries.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Productos resueltos</p>
                  <p className="text-lg font-bold text-emerald-500">{expressAnalysis.consolidated.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Sin match</p>
                  <p className="text-lg font-bold text-amber-500">{expressAnalysis.missingEntries.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lineas invalidas</p>
                  <p className="text-lg font-bold text-red-500">{expressAnalysis.invalidLines.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Total estimado</p>
                  <p className="text-base font-bold text-primary">{formatMoney(expressPreviewTotals.total, expressCurrency)}</p>
                  <p className="text-[10px] text-muted-foreground">{expressPreviewTotals.units} unidad(es)</p>
                </div>
              </div>

              <div className="grid gap-2 xl:grid-cols-2">
                {expressAnalysis.missingEntries.length > 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">Referencias sin match:</p>
                    <p className="mt-1">
                      {expressAnalysis.missingEntries
                        .slice(0, 6)
                        .map((entry) => `L${entry.lineNumber}: ${entry.reference}`)
                        .join(" | ")}
                    </p>
                  </div>
                ) : null}

                {expressAnalysis.invalidLines.length > 0 ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    <p className="font-semibold">Lineas invalidas:</p>
                    <p className="mt-1">
                      {expressAnalysis.invalidLines
                        .slice(0, 4)
                        .map((line) => `L${line.lineNumber}: ${line.reason}`)
                        .join(" | ")}
                    </p>
                  </div>
                ) : null}
              </div>

              {expressError ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {expressError}
                </div>
              ) : null}

              {expressSuccess ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {expressSuccess}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => void createExpressQuote()}
                  disabled={creatingExpress || loadingExpressData}
                >
                  {creatingExpress ? "Creando..." : "Crear cotizacion express"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <EmptyState title="Sin cotizaciones" description="No hay cotizaciones para los filtros actuales." />
      ) : (
        <SurfaceCard tone="default" padding="none" className="overflow-hidden rounded-[24px] border-border/70">
          {quotes.map((quote, index) => {
            const isExpanded = expandedId === quote.id;
            const clientLabel = quote.company_name || quote.contact_name || quote.client_id.slice(0, 8);
            const expired = isExpired(quote);

            return (
              <div key={quote.id} className={cn(index > 0 && "border-t border-border/70")}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : quote.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                    isExpanded ? "bg-secondary/60" : "bg-card hover:bg-secondary/50",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                    <FileText size={13} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{clientLabel}</span>
                      <QuoteStatusBadge status={quote.status} />
                      {quote.version > 1 ? <span className="text-[10px] text-muted-foreground">v{quote.version}</span> : null}
                      {expired && quote.status !== "expired" ? (
                        <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">Vencida</span>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString("es-AR")}
                      {quote.expires_at ? ` · vence ${new Date(quote.expires_at).toLocaleDateString("es-AR")}` : ""}
                      {` · ${quote.items?.length ?? 0} items`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-foreground">{formatMoney(quote.total, quote.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{quote.currency}</p>
                  </div>

                  {isExpanded ? (
                    <ChevronUp size={13} className="shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-border/70 bg-surface/60 px-4 py-4">
                    {quote.items.length > 0 ? (
                      <SurfaceCard tone="subtle" padding="sm" className="rounded-2xl">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Items</p>

                          {quote.items.map((item, itemIndex) => (
                            <div key={item.id ?? `${quote.id}-${itemIndex}`} className="flex items-center justify-between gap-3 py-1">
                              <span className="text-xs text-foreground">
                                {item.name ?? item.product_name ?? "Sin descripcion"} x {item.quantity ?? 0}
                              </span>
                              <span className="text-xs font-mono text-muted-foreground">
                                {formatMoney(item.totalWithIVA ?? item.total_price ?? 0, quote.currency)}
                              </span>
                            </div>
                          ))}

                          <div className="flex items-center justify-between border-t border-border/70 pt-2 text-xs font-semibold text-foreground">
                            <span>Total</span>
                            <span>{formatMoney(quote.total, quote.currency)}</span>
                          </div>
                        </div>
                      </SurfaceCard>
                    ) : null}

                    {convertError[quote.id] ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        {convertError[quote.id]}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      {quote.status === "draft" ? (
                        <Button
                          size="sm"
                          onClick={() => void updateStatus(quote.id, "sent")}
                          disabled={updatingStatus === quote.id}
                        >
                          <Send size={12} />
                          Marcar enviada
                        </Button>
                      ) : null}

                      {["draft", "sent", "viewed"].includes(quote.status) ? (
                        <Button
                          size="sm"
                          onClick={() => void updateStatus(quote.id, "approved")}
                          disabled={updatingStatus === quote.id}
                        >
                          <CheckCircle2 size={12} />
                          Aprobar
                        </Button>
                      ) : null}

                      {!["rejected", "expired", "converted"].includes(quote.status) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void updateStatus(quote.id, "rejected")}
                          disabled={updatingStatus === quote.id}
                        >
                          <XCircle size={12} />
                          Rechazar
                        </Button>
                      ) : null}

                      {["sent", "approved"].includes(quote.status) && !quote.converted_to_order_id ? (
                        <Button
                          size="sm"
                          className="ml-auto"
                          onClick={() => void convertToOrder(quote)}
                          disabled={converting === quote.id}
                        >
                          <ArrowRight size={12} />
                          {converting === quote.id ? "Convirtiendo..." : "Convertir a pedido"}
                        </Button>
                      ) : null}

                      {quote.converted_to_order_id ? (
                        <Badge variant="outline" className="ml-auto gap-1 border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                          <CheckCircle2 size={11} />
                          Pedido #{quote.converted_to_order_id}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </SurfaceCard>
      )}
    </div>
  );
}
