import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Package,
  Users,
  ClipboardList,
  FileText,
  X,
  Command,
  Landmark,
  Receipt,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type ResultType = "product" | "client" | "order" | "invoice" | "quote" | "payment" | "shipment";

interface SearchResult {
  id: string;
  type: ResultType;
  label: string;
  sub?: string;
  tab?: string;
  href?: string;
}

const TYPE_ICON: Record<ResultType, LucideIcon> = {
  product: Package,
  client: Users,
  order: ClipboardList,
  invoice: FileText,
  quote: Landmark,
  payment: CreditCard,
  shipment: Receipt,
};

const TYPE_LABEL: Record<ResultType, string> = {
  product: "Producto",
  client: "Cliente",
  order: "Pedido",
  invoice: "Factura",
  quote: "Cotización",
  payment: "Pago",
  shipment: "Remito",
};

interface Props {
  isDark?: boolean;
  products: Array<{ id: number; name: string; sku?: string; category?: string }>;
  clients: Array<{ id: string; company_name?: string; contact_name?: string; email?: string }>;
  orders: Array<{ id: string | number; client_id: string; order_number?: string; numero_remito?: string; total: number; status: string }>;
  invoices: Array<{ id: string; invoice_number: string; client_id: string; status: string; total: number }>;
  quotes: Array<{ id: number; client_id: string; status: string; total: number }>;
  payments: Array<{ id: string; client_id: string; descripcion?: string; reference_id?: string; monto: number; tipo: string }>;
  onNavigate: (tab: string) => void;
}

export function AdminSearch({
  isDark = true,
  products,
  clients,
  orders,
  invoices,
  quotes,
  payments,
  onNavigate,
}: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const clientMap = useCallback(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.email || client.id;
    });
    return map;
  }, [clients])();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSel(0);
    }
  }, [open]);

  const results: SearchResult[] = useCallback(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const output: SearchResult[] = [];

    products
      .filter((product) =>
        [product.name, product.sku, product.category].filter(Boolean).join(" ").toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((product) => {
        output.push({
          id: String(product.id),
          type: "product",
          label: product.name,
          sub: [product.sku, product.category].filter(Boolean).join(" · "),
          tab: "products",
        });
      });

    clients
      .filter((client) =>
        [client.company_name, client.contact_name, client.email, client.id].filter(Boolean).join(" ").toLowerCase().includes(q)
      )
      .slice(0, 5)
      .forEach((client) => {
        output.push({
          id: client.id,
          type: "client",
          label: client.company_name || client.contact_name || client.id,
          sub: [client.contact_name, client.email].filter(Boolean).join(" · "),
          href: `/clientes/${client.id}`,
        });
      });

    orders
      .filter((order) =>
        [
          order.order_number,
          String(order.id),
          order.status,
          order.numero_remito,
          clientMap[order.client_id],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 4)
      .forEach((order) => {
        output.push({
          id: String(order.id),
          type: "order",
          label: order.order_number ?? `#${String(order.id).slice(0, 8)}`,
          sub: `${clientMap[order.client_id] || order.client_id} · ${order.status}`,
          tab: "orders",
        });
      });

    orders
      .filter((order) => order.numero_remito?.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((order) => {
        output.push({
          id: `shipment-${order.id}`,
          type: "shipment",
          label: order.numero_remito ?? `REM-${String(order.id).slice(0, 8)}`,
          sub: clientMap[order.client_id] || order.client_id,
          tab: "orders",
        });
      });

    invoices
      .filter((invoice) =>
        [invoice.invoice_number, invoice.id, invoice.status, clientMap[invoice.client_id]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 4)
      .forEach((invoice) => {
        output.push({
          id: invoice.id,
          type: "invoice",
          label: invoice.invoice_number,
          sub: `${clientMap[invoice.client_id] || invoice.client_id} · ${invoice.status}`,
          tab: "invoices",
        });
      });

    quotes
      .filter((quote) =>
        [`COT-${String(quote.id).padStart(5, "0")}`, String(quote.id), quote.status, clientMap[quote.client_id]]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 4)
      .forEach((quote) => {
        output.push({
          id: String(quote.id),
          type: "quote",
          label: `COT-${String(quote.id).padStart(5, "0")}`,
          sub: `${clientMap[quote.client_id] || quote.client_id} · ${quote.status}`,
          tab: "quotes_admin",
        });
      });

    payments
      .filter((payment) =>
        [payment.descripcion, payment.reference_id, clientMap[payment.client_id], payment.tipo]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 4)
      .forEach((payment) => {
        output.push({
          id: payment.id,
          type: "payment",
          label: payment.descripcion || `Pago ${payment.id.slice(0, 8)}`,
          sub: `${clientMap[payment.client_id] || payment.client_id} · $${Math.round(Math.abs(payment.monto)).toLocaleString("es-AR")}`,
          tab: "credit",
        });
      });

    return output.slice(0, 18);
  }, [clientMap, clients, invoices, orders, payments, products, query, quotes])();

  useEffect(() => {
    setSel(0);
  }, [results.length]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    if (result.href) navigate(result.href);
    else if (result.tab) onNavigate(result.tab);
  }

  function handleKeyNav(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSel((current) => Math.min(current + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSel((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && results[sel]) handleSelect(results[sel]);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
          dk(
            "border-[#262626] text-[#525252] hover:border-[#333] hover:text-[#a3a3a3] bg-[#111]",
            "border-[#e0e0e0] text-[#a3a3a3] hover:border-[#c4c4c4] hover:text-[#737373] bg-[#f9f9f9]"
          )
        }`}
      >
        <Search size={12} />
        <span>Buscar…</span>
        <span className={`flex items-center gap-0.5 ml-1 text-[10px] ${dk("text-[#444]", "text-[#c4c4c4]")}`}>
          <Command size={10} />K
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className={`relative w-full max-w-xl rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className={`flex items-center gap-3 px-4 py-3 border-b ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
              <Search size={15} className="text-[#525252] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyNav}
                placeholder="Buscar productos, clientes, pedidos, remitos, facturas, pagos…"
                className={`flex-1 text-sm outline-none bg-transparent ${dk("text-white placeholder:text-[#404040]", "text-[#171717] placeholder:text-[#a3a3a3]")}`}
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-[#525252] hover:text-[#a3a3a3]">
                  <X size={13} />
                </button>
              )}
              <kbd className={`text-[10px] px-1.5 py-0.5 rounded border ${dk("border-[#333] text-[#525252]", "border-[#e0e0e0] text-[#a3a3a3]")}`}>
                Esc
              </kbd>
            </div>

            {results.length > 0 ? (
              <div className="py-1 max-h-80 overflow-y-auto">
                {results.map((result, index) => {
                  const Icon = TYPE_ICON[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSelect(result)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                        index === sel
                          ? dk("bg-[#1a2e22] text-[#2D9F6A]", "bg-[#f0faf5] text-[#1a7a50]")
                          : dk("text-[#d4d4d4] hover:bg-[#141414]", "text-[#525252] hover:bg-[#f9f9f9]")
                      }`}
                    >
                      <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${
                        index === sel
                          ? "border-[#2D9F6A]/30 bg-[#2D9F6A]/10"
                          : dk("border-[#262626] bg-[#1a1a1a]", "border-[#e5e5e5] bg-[#f5f5f5]")
                      }`}>
                        <Icon size={13} className={index === sel ? "text-[#2D9F6A]" : dk("text-[#525252]", "text-[#a3a3a3]")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.label}</p>
                        {result.sub && <p className="text-[10px] text-[#737373] truncate">{result.sub}</p>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#a3a3a3]")}`}>
                        {TYPE_LABEL[result.type]}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : query.trim().length >= 2 ? (
              <div className="py-8 text-center text-xs text-[#525252]">Sin resultados para "{query}"</div>
            ) : (
              <div className="px-4 py-4 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#444] mb-2">Sugerencias</p>
                {[
                  { icon: Package, label: "Ir a Productos", tab: "products" },
                  { icon: Users, label: "Ir a Clientes", tab: "clients" },
                  { icon: ClipboardList, label: "Ir a Pedidos", tab: "orders" },
                  { icon: FileText, label: "Ir a Facturas", tab: "invoices" },
                  { icon: Landmark, label: "Ir a Cotizaciones", tab: "quotes_admin" },
                  { icon: CreditCard, label: "Ir a Crédito y Pagos", tab: "credit" },
                ].map(({ icon: Icon, label, tab }) => (
                  <button
                    key={tab}
                    onClick={() => {
                      onNavigate(tab);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition ${dk("text-[#737373] hover:bg-[#141414] hover:text-white", "text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]")}`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
