import type { ReactNode } from "react";
import {
  Minus, Plus, Trash2, AlertCircle, AlertTriangle, ShieldAlert,
  Package2, Building2, UserRound, CalendarDays, Layers,
} from "lucide-react";
import type { Product } from "@/models/products";

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  totalWithIVA: number;
  ivaRate: number;
  ivaAmount: number;
  availableStock: number;
  hasStockError: boolean;
  hasStockWarning: boolean;
  hasMOQError: boolean;
  isVolumePricing: boolean;
  cost: number;
  margin: number;
}

interface OrderMeta {
  internalReference: string;
  branchName: string;
  receiverContact: string;
  requestedDate: string;
}

export interface CartStepProps {
  cartItems: CartItem[];
  blockingIssues: string[];
  warningIssues: string[];
  orderMeta: OrderMeta;
  formatPrice: (n: number) => string;
  isDark: boolean;
  onAddQty: (id: number) => void;
  onRemoveQty: (id: number) => void;
  onSetQty: (id: number, qty: number) => void;
  onRemoveItem: (id: number) => void;
  onUpdateMeta: <K extends keyof OrderMeta>(key: K, value: OrderMeta[K]) => void;
  /** Metadata de bundle por product_id para agrupar visualmente. */
  bundleCartMeta?: Record<number, { bundleId: string; bundleName: string }>;
}

export function CartStep({
  cartItems,
  blockingIssues,
  warningIssues,
  orderMeta,
  formatPrice,
  isDark,
  onAddQty,
  onRemoveQty,
  onSetQty,
  onRemoveItem,
  onUpdateMeta,
  bundleCartMeta,
}: CartStepProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const hasBlockingErrors = blockingIssues.length > 0;

  function renderCartRow(item: CartItem) {
    const { product, quantity, unitPrice, totalWithIVA, availableStock, hasStockError, hasStockWarning, hasMOQError } = item;
    const outOfStock = product.stock === 0;
    const minQty = product.min_order_qty ?? (product as unknown as { stock_min?: number }).stock_min ?? 0;

    return (
      <div
        key={product.id}
        className={`px-4 py-3 flex flex-col gap-2 md:grid md:grid-cols-[96px_1fr_64px_100px_96px_100px_32px] md:gap-x-3 md:items-center transition-colors
          ${(hasStockError || outOfStock) ? dk("bg-red-950/20", "bg-red-50/60") : ""}`}
      >
        <div>
          {product.sku ? (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${dk("bg-[#1a1a1a] text-[#737373]", "bg-[#f0f0f0] text-[#525252]")}`}>
              {product.sku}
            </span>
          ) : (
            <span className={`text-[10px] font-mono ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>—</span>
          )}
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`hidden md:flex h-9 w-9 shrink-0 rounded-lg items-center justify-center border ${dk("bg-[#0a0a0a] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")}`}>
            <img src={product.image} alt={product.name} className="max-h-7 max-w-7 object-contain" />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>{product.name}</p>
            <p className="text-[11px] text-gray-600">{product.category}</p>
            {outOfStock && <span className="inline-flex items-center gap-1 text-[10px] text-red-400 mt-0.5"><AlertCircle size={9} /> Sin stock</span>}
            {!outOfStock && hasStockError && <span className="inline-flex items-center gap-1 text-[10px] text-red-400 mt-0.5"><AlertCircle size={9} /> Solo {availableStock} disponibles</span>}
            {!hasStockError && hasStockWarning && <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-0.5"><AlertTriangle size={9} /> Últimas {availableStock}u</span>}
            {hasMOQError && <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 mt-0.5"><AlertTriangle size={9} /> Mín. {minQty}u por pedido</span>}
            <div className="flex items-center justify-between mt-1 md:hidden">
              <span className="text-xs text-[#2D9F6A] font-bold tabular-nums">{formatPrice(unitPrice)} c/u s/IVA</span>
              <span className={`text-sm font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{formatPrice(totalWithIVA)}</span>
            </div>
          </div>
        </div>
        <div className="hidden md:flex flex-col items-center justify-center">
          <span className={`text-[11px] font-semibold tabular-nums
            ${outOfStock ? "text-red-400" : hasStockError ? "text-red-400" : hasStockWarning ? "text-amber-400" : dk("text-gray-400", "text-gray-500")}`}>
            {availableStock}
          </span>
        </div>
        <div className="flex items-center gap-1 md:justify-center">
          <button
            onClick={() => onRemoveQty(product.id)}
            className={`h-7 w-7 rounded-lg flex items-center justify-center border active:scale-95 transition
              ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")}`}
          >
            <Minus size={11} />
          </button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => onSetQty(product.id, parseInt(e.target.value) || 0)}
            className={`w-10 text-center text-sm font-bold tabular-nums bg-transparent outline-none ${dk("text-white", "text-[#171717]")}`}
          />
          <button
            onClick={() => onAddQty(product.id)}
            className="h-7 w-7 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white flex items-center justify-center active:scale-95 transition"
          >
            <Plus size={11} />
          </button>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-sm font-bold text-[#2D9F6A] tabular-nums">{formatPrice(unitPrice)}</div>
          <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>s/IVA - {item.ivaRate}%</div>
        </div>
        <div className="hidden md:block text-right">
          <div className={`text-sm font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{formatPrice(totalWithIVA)}</div>
          <div className={`text-[10px] tabular-nums ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>s/IVA {formatPrice(item.totalPrice)}</div>
        </div>
        <div className="hidden md:flex items-center justify-center">
          <button
            onClick={() => onRemoveItem(product.id)}
            className={`p-1 rounded transition ${dk("text-[#525252] hover:text-red-400 hover:bg-red-500/10", "text-[#a3a3a3] hover:text-red-500 hover:bg-red-50")}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
        <div className="flex md:hidden">
          <button
            onClick={() => onRemoveItem(product.id)}
            className={`flex items-center gap-1 text-xs transition ${dk("text-[#525252] hover:text-red-400", "text-[#a3a3a3] hover:text-red-500")}`}
          >
            <Trash2 size={12} /> Eliminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Alerts */}
      <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
          <ShieldAlert size={13} className={hasBlockingErrors ? "text-red-400" : "text-amber-400"} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Estado del pedido</span>
        </div>
        <div className="px-4 py-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className={`rounded-xl border px-3 py-3 ${hasBlockingErrors ? dk("border-red-500/30 bg-red-500/10", "border-red-200 bg-red-50") : dk("border-[#2a2a2a] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
            <p className={`text-xs font-semibold mb-2 ${hasBlockingErrors ? "text-red-400" : dk("text-gray-300", "text-[#525252]")}`}>
              Bloqueantes {blockingIssues.length > 0 ? `(${blockingIssues.length})` : "(0)"}
            </p>
            {blockingIssues.length === 0 ? (
              <p className="text-xs text-[#2D9F6A]">No hay bloqueos para confirmar el pedido.</p>
            ) : (
              <div className="space-y-1">
                {blockingIssues.map((issue) => (
                  <p key={issue} className="text-xs text-red-300">- {issue}</p>
                ))}
              </div>
            )}
          </div>
          <div className={`rounded-xl border px-3 py-3 ${dk("border-[#2a2a2a] bg-[#171717]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
            <p className="text-xs font-semibold mb-2 text-amber-400">
              Atención comercial {warningIssues.length > 0 ? `(${warningIssues.length})` : "(0)"}
            </p>
            {warningIssues.length === 0 ? (
              <p className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>El pedido está limpio y listo para procesar.</p>
            ) : (
              <div className="space-y-1">
                {warningIssues.slice(0, 4).map((issue) => (
                  <p key={issue} className={`text-xs ${dk("text-gray-300", "text-[#525252]")}`}>- {issue}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Order meta */}
      <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
          <Building2 size={13} className="text-[#2D9F6A]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Datos del pedido</span>
        </div>
        <div className="px-4 py-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs block mb-1.5 text-gray-500">Referencia / OC interna</label>
            <input
              type="text"
              value={orderMeta.internalReference}
              onChange={(e) => onUpdateMeta("internalReference", e.target.value)}
              placeholder="Ej: OC-45892 / proyecto cliente"
              className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
            />
          </div>
          <div>
            <label className="text-xs block mb-1.5 text-gray-500">Sucursal / destino</label>
            <input
              type="text"
              value={orderMeta.branchName}
              onChange={(e) => onUpdateMeta("branchName", e.target.value)}
              placeholder="Casa central, sucursal norte, depósito..."
              className={`w-full text-sm outline-none rounded-lg px-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
            />
          </div>
          <div>
            <label className="text-xs block mb-1.5 text-gray-500">Contacto receptor</label>
            <div className="relative">
              <UserRound size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dk("text-[#525252]", "text-[#a3a3a3]")}`} />
              <input
                type="text"
                value={orderMeta.receiverContact}
                onChange={(e) => onUpdateMeta("receiverContact", e.target.value)}
                placeholder="Quién recibe o coordina"
                className={`w-full text-sm outline-none rounded-lg pl-9 pr-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1.5 text-gray-500">Fecha requerida</label>
            <div className="relative">
              <CalendarDays size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${dk("text-[#525252]", "text-[#a3a3a3]")}`} />
              <input
                type="date"
                value={orderMeta.requestedDate}
                onChange={(e) => onUpdateMeta("requestedDate", e.target.value)}
                className={`w-full text-sm outline-none rounded-lg pl-9 pr-3 py-2 border transition ${dk("bg-[#1a1a1a] border-[#2a2a2a] text-white focus:border-[#2D9F6A]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Products table */}
      <section className={`border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
          <Package2 size={13} className="text-[#2D9F6A]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Productos ({cartItems.length})</span>
        </div>
        {/* Column labels */}
        <div className={`hidden md:grid grid-cols-[96px_1fr_64px_100px_96px_100px_32px] gap-x-3 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 border-b ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
          <span>SKU</span>
          <span>Producto</span>
          <span className="text-center">Stock</span>
          <span className="text-center">Cantidad</span>
          <span className="text-right">Precio unit.</span>
          <span className="text-right">Total c/IVA</span>
          <span />
        </div>
        <div className={`divide-y ${dk("divide-[#1a1a1a]", "divide-[#f0f0f0]")}`}>
          {/* Build display list with optional bundle group headers */}
          {(() => {
            if (!bundleCartMeta || Object.keys(bundleCartMeta).length === 0) {
              return cartItems.map((item) => renderCartRow(item));
            }

            // Group items: bundle groups first (in insertion order), then ungrouped
            const bundleGroups = new Map<string, { name: string; items: CartItem[] }>();
            const ungrouped: CartItem[] = [];

            for (const item of cartItems) {
              const meta = bundleCartMeta[item.product.id];
              if (meta) {
                const existing = bundleGroups.get(meta.bundleId);
                if (existing) {
                  existing.items.push(item);
                } else {
                  bundleGroups.set(meta.bundleId, { name: meta.bundleName, items: [item] });
                }
              } else {
                ungrouped.push(item);
              }
            }

            const rows: ReactNode[] = [];
            bundleGroups.forEach(({ name, items: groupItems }) => {
              rows.push(
                <div key={`bundle-header-${name}`} className={`flex items-center gap-2 px-4 py-1.5 ${dk("bg-primary/10", "bg-primary/5")} border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                  <Layers size={11} className="text-primary shrink-0" />
                  <span className="text-[11px] font-semibold text-primary truncate">{name}</span>
                </div>
              );
              groupItems.forEach((item) => rows.push(renderCartRow(item)));
            });
            ungrouped.forEach((item) => rows.push(renderCartRow(item)));
            return rows;
          })()}
        </div>
      </section>
    </div>
  );
}
