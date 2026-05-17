import { Suspense, lazy } from "react";
import { Download } from "lucide-react";

import { KeepAliveTab } from "@/components/admin/layout/KeepAliveTab";
import { exportReportsCSV } from "@/lib/exportCsv";
import type { Tab } from "@/components/admin/layout/adminNavConfig";
import type { Product } from "@/models/products";

const SuppliersTab = lazy(() => import("@/components/admin/SuppliersTab").then((m) => ({ default: m.SuppliersTab })));
const BrandsTab = lazy(() => import("@/components/admin/BrandsTab").then((m) => ({ default: m.BrandsTab })));
const StockTab = lazy(() => import("@/components/admin/StockTab").then((m) => ({ default: m.StockTab })));
const StockMovementsTab = lazy(() => import("@/components/admin/StockMovementsTab").then((m) => ({ default: m.StockMovementsTab })));
const InvoicesTab = lazy(() => import("@/components/admin/InvoicesTab").then((m) => ({ default: m.InvoicesTab })));
const DocumentsTab = lazy(() => import("@/components/admin/DocumentsTab").then((m) => ({ default: m.DocumentsTab })));
const CreditTab = lazy(() => import("@/components/admin/CreditTab").then((m) => ({ default: m.CreditTab })));
const BusinessAlertsTab = lazy(() => import("@/components/admin/BusinessAlertsTab").then((m) => ({ default: m.BusinessAlertsTab })));
const QuotesAdminTab = lazy(() => import("@/components/admin/QuotesAdminTab").then((m) => ({ default: m.QuotesAdminTab })));
const PurchaseOrdersTab = lazy(() => import("@/components/admin/PurchaseOrdersTab").then((m) => ({ default: m.PurchaseOrdersTab })));
const PricingRulesTab = lazy(() => import("@/components/admin/PricingRulesTab").then((m) => ({ default: m.PricingRulesTab })));
const BundlesAdminTab = lazy(() => import("@/components/admin/BundlesAdminTab").then((m) => ({ default: m.BundlesAdminTab })));
const ReportsTab = lazy(() => import("@/components/admin/ReportsTab").then((m) => ({ default: m.ReportsTab })));
const ActivityLogTab = lazy(() => import("@/components/admin/ActivityLogTab").then((m) => ({ default: m.ActivityLogTab })));
const SupportTab = lazy(() => import("@/components/admin/SupportTab").then((m) => ({ default: m.SupportTab })));
const WebhooksTab = lazy(() => import("@/components/admin/WebhooksTab").then((m) => ({ default: m.WebhooksTab })));
const RmaAdminTab = lazy(() => import("@/components/admin/RmaAdminTab").then((m) => ({ default: m.RmaAdminTab })));
const SerialsTab = lazy(() => import("@/components/admin/SerialsTab").then((m) => ({ default: m.SerialsTab })));
const PriceAgreementsTab = lazy(() => import("@/components/admin/PriceAgreementsTab").then((m) => ({ default: m.PriceAgreementsTab })));
const SupplierApisSyncTab = lazy(() => import("@/components/admin/SupplierApisSyncTab").then((m) => ({ default: m.SupplierApisSyncTab })));

interface AdminClient {
  id: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
}

interface AdminOrder {
  id: string | number;
  client_id: string;
  status: string;
  total: number;
  created_at: string;
  products?: Array<{
    product_id?: number | string;
    sku?: string;
    name?: string;
    quantity?: number;
    total_price?: number;
    cost_price?: number;
    category?: string;
  }>;
}

interface InvoiceSearchItem {
  id: string;
  invoice_number: string;
  client_id: string;
  status: string;
  total: number;
  subtotal: number;
  iva_total: number;
  currency: "USD" | "ARS";
  exchange_rate?: number | null;
  created_at: string;
  due_date?: string;
}

export interface AdminCommercialTabsProps {
  activeTab: Tab;
  isDark: boolean;
  userId: string;
  products: Product[];
  orders: AdminOrder[];
  clients: AdminClient[];
  categoryNames: string[];
  invoiceSearchItems: InvoiceSearchItem[];
  formatPrice: (n: number) => string;
  onNavigateTab: (tab: Tab) => void;
  onProductsRefresh: () => void;
}

/**
 * Renders the commercial / stock / catalog-management admin tabs.
 *
 * Extracted from `Admin.tsx` to keep that file focused on top-level orchestration
 * and data fetching. Each tab here is a `<KeepAliveTab>` that mounts on first
 * activation and stays mounted afterwards.
 */
export function AdminCommercialTabs({
  activeTab,
  isDark,
  userId,
  products,
  orders,
  clients,
  categoryNames,
  invoiceSearchItems,
  formatPrice,
  onNavigateTab,
  onProductsRefresh,
}: AdminCommercialTabsProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const clientRows = clients.map((client) => ({
    id: client.id,
    company_name: client.company_name ?? client.contact_name ?? client.email ?? client.id,
    contact_name: client.contact_name ?? client.company_name ?? client.email ?? client.id,
  }));
  const reportOrders = orders.map((order) => ({
    ...order,
    id: String(order.id),
    products: order.products ?? [],
  }));

  return (
    <>
      <KeepAliveTab active={activeTab === "suppliers"} id="suppliers">
        <SuppliersTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "brands"} id="brands">
        <BrandsTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "stock"} id="stock">
        <StockTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "movements"} id="movements">
        <StockMovementsTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "invoices"} id="invoices">
        <InvoicesTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "documents"} id="documents">
        <DocumentsTab
          isDark={isDark}
          orders={orders}
          clients={clientRows}
          onOpenTab={(tab) => onNavigateTab(tab as Tab)}
        />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "credit"} id="credit">
        <CreditTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "business_alerts"} id="business_alerts">
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
          <BusinessAlertsTab isDark={isDark} />
        </Suspense>
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "quotes_admin"} id="quotes_admin">
        <QuotesAdminTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "purchase_orders"} id="purchase_orders">
        <PurchaseOrdersTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "pricing"} id="pricing">
        <PricingRulesTab isDark={isDark} categories={categoryNames} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "bundles"} id="bundles">
        <BundlesAdminTab products={products} isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "reports"} id="reports">
        <div className="space-y-4 max-w-5xl">
          <div className="flex justify-end">
            <button
              onClick={() => exportReportsCSV(reportOrders, clientRows)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
            >
              <Download size={12} /> Exportar ventas CSV
            </button>
          </div>
          <ReportsTab
            products={products}
            orders={reportOrders}
            clients={clientRows}
            invoices={invoiceSearchItems}
            formatPrice={formatPrice}
            isDark={isDark}
          />
        </div>
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "activity"} id="activity">
        <ActivityLogTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "support"} id="support">
        <SupportTab isDark={isDark} clients={clientRows} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "webhooks"} id="webhooks">
        <WebhooksTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "rma"} id="rma">
        <RmaAdminTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "serials"} id="serials">
        <SerialsTab isDark={isDark} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "price_agreements"} id="price_agreements">
        <PriceAgreementsTab isDark={isDark} clients={clientRows} />
      </KeepAliveTab>

      <KeepAliveTab active={activeTab === "supplier_sync"} id="supplier_sync">
        <SupplierApisSyncTab isDark={isDark} userId={userId} onSyncDone={onProductsRefresh} />
      </KeepAliveTab>
    </>
  );
}
