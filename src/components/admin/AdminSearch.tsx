import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Package, Users, ClipboardList, FileText, X, Command } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Types ──────────────────────────────────────────────────────────────────────

type ResultType = "product" | "client" | "order" | "invoice";

interface SearchResult {
  id: string;
  type: ResultType;
  label: string;
  sub?: string;
  tab?: string; // admin tab to navigate to
  href?: string;
}

const TYPE_ICON: Record<ResultType, any> = {
  product: Package,
  client:  Users,
  order:   ClipboardList,
  invoice: FileText,
};

const TYPE_LABEL: Record<ResultType, string> = {
  product: "Producto",
  client:  "Cliente",
  order:   "Pedido",
  invoice: "Factura",
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  isDark?: boolean;
  products: Array<{ id: number; name: string; sku?: string; category?: string }>;
  clients:  Array<{ id: string; company_name?: string; contact_name?: string }>;
  orders:   Array<{ id: string; order_number?: string; total: number; status: string }>;
  onNavigate: (tab: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminSearch({ isDark = true, products, clients, orders, onNavigate }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const navigate = useNavigate();

  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [sel,     setSel]     = useState(0);
  const inputRef              = useRef<HTMLInputElement>(null);

  // cmd+K / ctrl+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setSel(0); }
  }, [open]);

  const results: SearchResult[] = useCallback((): SearchResult[] => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const out: SearchResult[] = [];

    // Products
    products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((p) =>
        out.push({ id: String(p.id), type: "product", label: p.name, sub: p.sku ?? p.category, tab: "products" })
      );

    // Clients
    clients
      .filter((c) =>
        (c.company_name ?? "").toLowerCase().includes(q) ||
        (c.contact_name ?? "").toLowerCase().includes(q)
      )
      .slice(0, 4)
      .forEach((c) =>
        out.push({
          id: c.id,
          type: "client",
          label: c.company_name || c.contact_name || c.id,
          sub: c.contact_name,
          href: `/clientes/${c.id}`,
        })
      );

    // Orders
    orders
      .filter((o) =>
        (o.order_number ?? "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach((o) =>
        out.push({
          id: o.id,
          type: "order",
          label: o.order_number ?? `#${o.id.slice(0, 8)}`,
          sub: o.status,
          tab: "orders",
        })
      );

    return out;
  }, [query, products, clients, orders])();

  useEffect(() => { setSel(0); }, [results.length]);

  function handleSelect(r: SearchResult) {
    setOpen(false);
    if (r.href) { navigate(r.href); }
    else if (r.tab) { onNavigate(r.tab); }
  }

  function handleKeyNav(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[sel]) handleSelect(results[sel]);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={`hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition ${
          dk("border-[#262626] text-[#525252] hover:border-[#333] hover:text-[#a3a3a3] bg-[#111]",
             "border-[#e0e0e0] text-[#a3a3a3] hover:border-[#c4c4c4] hover:text-[#737373] bg-[#f9f9f9]")
        }`}
      >
        <Search size={12} />
        <span>Buscar…</span>
        <span className={`flex items-center gap-0.5 ml-1 text-[10px] ${dk("text-[#444]","text-[#c4c4c4]")}`}>
          <Command size={10} />K
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden ${
            dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")
          }`}>
            {/* Input */}
            <div className={`flex items-center gap-3 px-4 py-3 border-b ${dk("border-[#1a1a1a]","border-[#f0f0f0]")}`}>
              <Search size={15} className="text-[#525252] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyNav}
                placeholder="Buscar productos, clientes, pedidos…"
                className={`flex-1 text-sm outline-none bg-transparent ${dk("text-white placeholder:text-[#404040]","text-[#171717] placeholder:text-[#a3a3a3]")}`}
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-[#525252] hover:text-[#a3a3a3]">
                  <X size={13} />
                </button>
              )}
              <kbd className={`text-[10px] px-1.5 py-0.5 rounded border ${dk("border-[#333] text-[#525252]","border-[#e0e0e0] text-[#a3a3a3]")}`}>
                Esc
              </kbd>
            </div>

            {/* Results */}
            {results.length > 0 ? (
              <div className="py-1 max-h-72 overflow-y-auto">
                {results.map((r, i) => {
                  const Icon = TYPE_ICON[r.type];
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => handleSelect(r)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                        i === sel
                          ? dk("bg-[#1a2e22] text-[#2D9F6A]","bg-[#f0faf5] text-[#1a7a50]")
                          : dk("text-[#d4d4d4] hover:bg-[#141414]","text-[#525252] hover:bg-[#f9f9f9]")
                      }`}
                    >
                      <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${
                        i === sel
                          ? "border-[#2D9F6A]/30 bg-[#2D9F6A]/10"
                          : dk("border-[#262626] bg-[#1a1a1a]","border-[#e5e5e5] bg-[#f5f5f5]")
                      }`}>
                        <Icon size={13} className={i === sel ? "text-[#2D9F6A]" : dk("text-[#525252]","text-[#a3a3a3]")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        {r.sub && <p className="text-[10px] text-[#737373] truncate">{r.sub}</p>}
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${dk("bg-[#1a1a1a] text-[#525252]","bg-[#f0f0f0] text-[#a3a3a3]")}`}>
                        {TYPE_LABEL[r.type]}
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
                  { icon: Package,      label: "Ir a Productos",   tab: "products" },
                  { icon: Users,        label: "Ir a Clientes",    tab: "clients"  },
                  { icon: ClipboardList,label: "Ir a Pedidos",     tab: "orders"   },
                  { icon: FileText,     label: "Ir a Facturas",    tab: "invoices" },
                ].map(({ icon: Icon, label, tab }) => (
                  <button
                    key={tab}
                    onClick={() => { onNavigate(tab); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition ${
                      dk("text-[#737373] hover:bg-[#141414] hover:text-white","text-[#737373] hover:bg-[#f5f5f5] hover:text-[#171717]")
                    }`}
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
