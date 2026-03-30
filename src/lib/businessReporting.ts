import { convertMoneyAmount, getEffectiveInvoiceAmounts } from "@/lib/money";
import type { Currency } from "@/context/CurrencyContext";
import type { Product } from "@/models/products";

interface OrderLine {
  product_id?: number | string;
  sku?: string;
  name?: string;
  quantity?: number;
  total_price?: number;
  cost_price?: number;
  category?: string;
}

interface OrderLike {
  id: string | number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  products?: OrderLine[];
}

interface InvoiceLike {
  id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  items?: unknown[];
  total: number;
  subtotal: number;
  iva_total: number;
  currency: "USD" | "ARS";
  exchange_rate?: number | null;
  created_at: string;
  due_date?: string;
}

interface ProductMatch {
  category: string;
  costPrice: number;
  stock: number;
  stockMin: number;
}

export interface ClientSalesReport {
  clientId: string;
  clientName: string;
  revenue: number;
  grossProfit: number;
  marginPct: number;
  orderCount: number;
  avgOrderValue: number;
  lastOrderDate?: string;
}

export interface ProductSalesReport {
  productName: string;
  category: string;
  units: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
}

export interface CategoryMarginReport {
  category: string;
  units: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
}

export interface DebtAgingBucket {
  label: string;
  count: number;
  amount: number;
}

export interface ReorderForecastItem {
  productName: string;
  category: string;
  stock: number;
  stockMin: number;
  velocity30d: number;
  daysOfCover: number | null;
  suggestedReorder: number;
}

function isRevenueOrder(status: string) {
  return new Set(["approved", "preparing", "shipped", "dispatched", "delivered"]).has(status);
}

function normalizeLineKey(line: OrderLine) {
  return String(line.product_id ?? line.sku ?? line.name ?? "linea");
}

function buildProductMap(products: Product[]) {
  const map = new Map<string, ProductMatch>();
  products.forEach((product) => {
    const match: ProductMatch = {
      category: product.category || "Sin categoría",
      costPrice: Number(product.cost_price ?? 0),
      stock: Number(product.stock ?? 0),
      stockMin: Number(product.stock_min ?? 0),
    };
    map.set(String(product.id), match);
    if (product.sku) map.set(product.sku, match);
    map.set(product.name.toLowerCase(), match);
  });
  return map;
}

function resolveProduct(line: OrderLine, productMap: Map<string, ProductMatch>): ProductMatch {
  return (
    productMap.get(String(line.product_id ?? "")) ||
    productMap.get(line.sku ?? "") ||
    productMap.get((line.name ?? "").toLowerCase()) || {
      category: line.category || "Sin categoría",
      costPrice: Number(line.cost_price ?? 0),
      stock: 0,
      stockMin: 0,
    }
  );
}

export function buildClientSalesReport(
  orders: OrderLike[],
  clientMap: Record<string, string>
): ClientSalesReport[] {
  const report = new Map<string, ClientSalesReport>();

  orders
    .filter((order) => isRevenueOrder(order.status))
    .forEach((order) => {
      const current = report.get(order.client_id) ?? {
        clientId: order.client_id,
        clientName: clientMap[order.client_id] || order.client_id,
        revenue: 0,
        grossProfit: 0,
        marginPct: 0,
        orderCount: 0,
        avgOrderValue: 0,
        lastOrderDate: order.created_at,
      };

      const cost = (order.products ?? []).reduce(
        (sum, line) => sum + (Number(line.cost_price ?? 0) * Number(line.quantity ?? 0)),
        0
      );

      current.revenue += Number(order.total ?? 0);
      current.grossProfit += Number(order.total ?? 0) - cost;
      current.orderCount += 1;
      if (!current.lastOrderDate || new Date(order.created_at).getTime() > new Date(current.lastOrderDate).getTime()) {
        current.lastOrderDate = order.created_at;
      }

      report.set(order.client_id, current);
    });

  return Array.from(report.values())
    .map((entry) => ({
      ...entry,
      avgOrderValue: entry.orderCount > 0 ? entry.revenue / entry.orderCount : 0,
      marginPct: entry.revenue > 0 ? (entry.grossProfit / entry.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function buildProductSalesReport(
  orders: OrderLike[],
  products: Product[]
): ProductSalesReport[] {
  const productMap = buildProductMap(products);
  const report = new Map<string, ProductSalesReport>();

  orders
    .filter((order) => isRevenueOrder(order.status))
    .forEach((order) => {
      (order.products ?? []).forEach((line) => {
        const quantity = Number(line.quantity ?? 0);
        if (quantity <= 0) return;
        const match = resolveProduct(line, productMap);
        const key = normalizeLineKey(line);
        const current = report.get(key) ?? {
          productName: line.name || "Producto",
          category: match.category,
          units: 0,
          revenue: 0,
          cost: 0,
          grossProfit: 0,
          marginPct: 0,
        };
        const revenue = Number(line.total_price ?? 0);
        const cost = Number(line.cost_price ?? match.costPrice) * quantity;

        current.units += quantity;
        current.revenue += revenue;
        current.cost += cost;
        report.set(key, current);
      });
    });

  return Array.from(report.values())
    .map((entry) => ({
      ...entry,
      grossProfit: entry.revenue - entry.cost,
      marginPct: entry.revenue > 0 ? ((entry.revenue - entry.cost) / entry.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function buildCategoryMarginReport(
  orders: OrderLike[],
  products: Product[]
): CategoryMarginReport[] {
  const byProduct = buildProductSalesReport(orders, products);
  const report = new Map<string, CategoryMarginReport>();

  byProduct.forEach((product) => {
    const current = report.get(product.category) ?? {
      category: product.category,
      units: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      marginPct: 0,
    };
    current.units += product.units;
    current.revenue += product.revenue;
    current.cost += product.cost;
    report.set(product.category, current);
  });

  return Array.from(report.values())
    .map((entry) => ({
      ...entry,
      grossProfit: entry.revenue - entry.cost,
      marginPct: entry.revenue > 0 ? ((entry.revenue - entry.cost) / entry.revenue) * 100 : 0,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);
}

export function buildDebtAgingReport(
  invoices: InvoiceLike[],
  preferredCurrency: Currency,
  exchangeRate: number,
  now = new Date()
): DebtAgingBucket[] {
  const buckets = [
    { label: "Al día", min: -9999, max: 0, count: 0, amount: 0 },
    { label: "1-15 días", min: 1, max: 15, count: 0, amount: 0 },
    { label: "16-30 días", min: 16, max: 30, count: 0, amount: 0 },
    { label: "31-60 días", min: 31, max: 60, count: 0, amount: 0 },
    { label: "61+ días", min: 61, max: Number.POSITIVE_INFINITY, count: 0, amount: 0 },
  ];

  invoices
    .filter((invoice) => ["draft", "sent", "overdue"].includes(invoice.status))
    .forEach((invoice) => {
      const effective = getEffectiveInvoiceAmounts(
        {
          ...invoice,
          status: invoice.status as "draft" | "sent" | "paid" | "overdue" | "cancelled",
          items: invoice.items ?? [],
        },
        exchangeRate
      );
      const dueAt = invoice.due_date ? new Date(invoice.due_date) : new Date(invoice.created_at);
      const diffDays = Math.max(0, Math.floor((now.getTime() - dueAt.getTime()) / 86400000));
      const converted = convertMoneyAmount(
        effective.total,
        effective.currency,
        preferredCurrency,
        exchangeRate
      );
      const bucket = buckets.find((entry) => diffDays >= entry.min && diffDays <= entry.max);
      if (!bucket) return;
      bucket.count += 1;
      bucket.amount += converted;
    });

  return buckets.map(({ label, count, amount }) => ({ label, count, amount }));
}

export function buildReorderForecast(
  orders: OrderLike[],
  products: Product[],
  now = new Date()
): ReorderForecastItem[] {
  const productMap = buildProductMap(products);
  const cutoff = new Date(now.getTime() - 30 * 86400000);
  const velocityMap = new Map<string, { units: number; name: string; category: string }>();

  orders
    .filter((order) => new Date(order.created_at).getTime() >= cutoff.getTime())
    .filter((order) => isRevenueOrder(order.status))
    .forEach((order) => {
      (order.products ?? []).forEach((line) => {
        const quantity = Number(line.quantity ?? 0);
        if (quantity <= 0) return;
        const key = normalizeLineKey(line);
        const match = resolveProduct(line, productMap);
        const current = velocityMap.get(key) ?? {
          units: 0,
          name: line.name || "Producto",
          category: match.category,
        };
        current.units += quantity;
        velocityMap.set(key, current);
      });
    });

  return Array.from(velocityMap.entries())
    .map(([key, velocity]) => {
      const match = productMap.get(key) || productMap.get(velocity.name.toLowerCase()) || {
        category: velocity.category,
        costPrice: 0,
        stock: 0,
        stockMin: 0,
      };
      const dailyVelocity = velocity.units / 30;
      const reorderPoint = Math.ceil(dailyVelocity * 21 + (match.stockMin || 0));
      const suggestedReorder = Math.max(0, reorderPoint - match.stock);
      const daysOfCover = dailyVelocity > 0 ? match.stock / dailyVelocity : null;
      return {
        productName: velocity.name,
        category: match.category,
        stock: match.stock,
        stockMin: match.stockMin,
        velocity30d: Number(dailyVelocity.toFixed(2)),
        daysOfCover: daysOfCover != null ? Number(daysOfCover.toFixed(1)) : null,
        suggestedReorder,
      };
    })
    .filter((item) => item.velocity30d > 0 || item.stock <= item.stockMin)
    .sort((a, b) => {
      const aRisk = a.daysOfCover ?? Number.POSITIVE_INFINITY;
      const bRisk = b.daysOfCover ?? Number.POSITIVE_INFINITY;
      return aRisk - bRisk || b.suggestedReorder - a.suggestedReorder;
    })
    .slice(0, 8);
}
