import * as React from "react";
import { Box, CreditCard, Package, ShoppingCart, FileText, AlertTriangle } from "lucide-react";

import { AppShell } from "@/components/portal/AppShell";
import { CartSheet } from "@/components/portal/CartSheet";
import { CommandPalette } from "@/components/portal/CommandPalette";
import { TopBar } from "@/components/portal/TopBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { MoneyCell } from "@/components/ui/money-cell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusDot } from "@/components/ui/status-dot";
import { StockCell } from "@/components/ui/stock-cell";
import { SurfaceCard } from "@/components/ui/surface-card";
import { TierTable, type PriceTier } from "@/components/ui/tier-table";

const sampleTiers: PriceTier[] = [
  { minQty: 1, maxQty: 9, unitPrice: 250, from: "USD" },
  { minQty: 10, maxQty: 49, unitPrice: 235, from: "USD" },
  { minQty: 50, unitPrice: 215, from: "USD" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="portal-h3">{title}</h2>
      <SurfaceCard tone="default" padding="md" className="space-y-4">
        {children}
      </SurfaceCard>
    </section>
  );
}

function StyleguidePage() {
  const [cartOpen, setCartOpen] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);

  return (
    <AppShell
      topBar={
        <TopBar
          cartCount={3}
          alertCount={2}
          creditAvailable={42_500}
          creditTotal={60_000}
          creditUsedPct={(60_000 - 42_500) / 60_000}
          onOpenCart={() => setCartOpen(true)}
          onOpenCommand={() => setCmdOpen(true)}
        />
      }
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Portal 2.0"
          title="Styleguide · Foundations"
          description="Componentes base del rediseño. Validá densidad, tipografía y dark mode con el toggle del topbar."
          actions={
            <>
              <Button variant="default">CTA primario</Button>
              <Button variant="outline">Secundario</Button>
              <Button variant="soft">Soft</Button>
              <Button variant="toolbar">Toolbar</Button>
              <Button variant="ghost">Ghost</Button>
            </>
          }
        />

        <Section title="Color tokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { name: "brand", className: "bg-brand text-brand-foreground" },
              { name: "success", className: "bg-success text-success-foreground" },
              { name: "warning", className: "bg-warning text-warning-foreground" },
              { name: "danger", className: "bg-danger text-danger-foreground" },
              { name: "info", className: "bg-info text-info-foreground" },
              { name: "surface-1", className: "bg-surface-1 text-foreground border border-border/70" },
              { name: "surface-2", className: "bg-surface-2 text-foreground border border-border/70" },
              { name: "surface-3", className: "bg-surface-3 text-foreground border border-border/70" },
            ].map((swatch) => (
              <div
                key={swatch.name}
                className={`flex h-16 items-center justify-center rounded-xl px-3 text-[12px] font-semibold ${swatch.className}`}
              >
                {swatch.name}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografía">
          <div className="space-y-2">
            <p className="portal-h1">H1 · 28/32 — Catálogo profesional</p>
            <p className="portal-h2">H2 · 22/28 — Resumen de tu cuenta</p>
            <p className="portal-h3">H3 · 18/24 — Pedidos en curso</p>
            <p className="portal-body">Body · 14/20 — Texto principal del portal con interlineado de 20px.</p>
            <p className="portal-micro">Micro · 12/16 — pista, label de columna, helper.</p>
            <p className="portal-tabular text-[14px]">Tabular · USD 1.234,56 · 1.000.000 · 99,9%</p>
            <p className="portal-sku text-[14px]">SKU · AMD-RYZEN-7-5700G · MB-MSI-A520M-PRO</p>
          </div>
        </Section>

        <Section title="Métricas">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Crédito disponible" value="USD 42.500" detail="58% utilizado" trend="↑ 4%" icon={<CreditCard className="h-4 w-4" />} />
            <MetricCard label="Pedidos en curso" value="7" detail="USD 12.300 en proceso" icon={<ShoppingCart className="h-4 w-4" />} />
            <MetricCard label="Cotizaciones" value="3" detail="2 esperando tu OK" icon={<FileText className="h-4 w-4" />} />
            <MetricCard label="Última factura" value="USD 4.820" detail="Pagada hace 3 días" icon={<Package className="h-4 w-4" />} />
          </div>
        </Section>

        <Section title="Stock & estados">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SurfaceCard tone="subtle" padding="sm" className="space-y-2">
              <p className="portal-micro">Stock alto</p>
              <StockCell available={142} reserved={12} />
            </SurfaceCard>
            <SurfaceCard tone="subtle" padding="sm" className="space-y-2">
              <p className="portal-micro">Stock bajo</p>
              <StockCell available={4} reserved={2} />
            </SurfaceCard>
            <SurfaceCard tone="subtle" padding="sm" className="space-y-2">
              <p className="portal-micro">Sin stock + ETA</p>
              <StockCell available={0} etaDays={5} />
            </SurfaceCard>
            <SurfaceCard tone="subtle" padding="sm" className="space-y-2">
              <p className="portal-micro">Compact</p>
              <StockCell available={47} density="compact" />
            </SurfaceCard>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusDot tone="success" label="Disponible" />
            <StatusDot tone="warning" label="Stock bajo" />
            <StatusDot tone="danger" label="Sin stock" />
            <StatusDot tone="info" label="ETA 24h" />
            <StatusDot tone="neutral" label="Sin info" />
          </div>
        </Section>

        <Section title="Money & tiers">
          <div className="grid gap-4 lg:grid-cols-2">
            <SurfaceCard tone="subtle" padding="sm" className="space-y-3">
              <p className="portal-micro">Precios</p>
              <div className="flex flex-col gap-2">
                <MoneyCell value={235} from="USD" emphasis="strong" hint="+ IVA" />
                <MoneyCell value={250} from="USD" original={310} emphasis="strong" hint="oferta" />
                <MoneyCell value={1_240_000} from="ARS" emphasis="default" showSecondary />
              </div>
            </SurfaceCard>
            <SurfaceCard tone="subtle" padding="sm" className="space-y-3">
              <p className="portal-micro">Tiers (qty actual = 12)</p>
              <TierTable tiers={sampleTiers} currentQty={12} />
            </SurfaceCard>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Disponible</Badge>
            <Badge variant="warning">Stock bajo</Badge>
            <Badge variant="destructive">Vencida</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="muted">Borrador</Badge>
          </div>
        </Section>

        <Section title="DataTableShell + EmptyState">
          <DataTableShell
            title="Pedidos recientes"
            description="Última actividad de la cuenta"
            actions={<Button variant="outline" size="sm">Ver todos</Button>}
            meta={<Badge variant="muted">12 pedidos · últimos 30 días</Badge>}
          >
            <EmptyState
              title="Aún no hay pedidos en este rango"
              description="Cambiá el filtro de fecha o cargá un pedido por SKU desde el carrito rápido."
              icon={<Box className="h-6 w-6" />}
              actionLabel="Cargar pedido por SKU"
              onAction={() => undefined}
            />
          </DataTableShell>
        </Section>

        <Section title="Banners">
          <div className="space-y-2">
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 text-[13px]">
                <p className="font-semibold">Tenés 2 facturas próximas a vencer</p>
                <p className="text-warning/80">Revisá tus documentos antes del 5/05 para evitar bloqueos de crédito.</p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <CartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        itemCount={3}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="portal-micro">Total</p>
              <p className="portal-h3 portal-tabular">USD 1.245,30</p>
            </div>
            <Button>Ir a checkout</Button>
          </div>
        }
      >
        <EmptyState
          title="Demo del carrito"
          description="En Sprint 1 acá se renderiza el contenido real del carrito existente."
          icon={<ShoppingCart className="h-6 w-6" />}
        />
      </CartSheet>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </AppShell>
  );
}

export default StyleguidePage;
