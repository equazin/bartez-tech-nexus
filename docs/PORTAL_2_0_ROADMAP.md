# Portal B2B 2.0 — Roadmap

Estado al cierre de esta sesión:

- **PRE-SPRINT 0 — Foundations**: ✅ completado
- **Sprint 1 — AppShell + Sidebar + Sub-rutas**: ✅ completado
- **Sprint 2 → 7**: pendientes (detalle abajo)

Plan completo en `~/.claude/plans/bubbly-finding-crescent.md` (fuera del repo).

---

## ✅ PRE-SPRINT 0 — Foundations (cerrado)

**Tokens y CSS** — `tailwind.config.ts`, `src/index.css`
- Paleta `brand` 50–900 + semánticos `success`/`warning`/`danger`/`info` (con `*-foreground` y `*-soft`).
- `surface-1/2/3` para layering en dark mode.
- Utilities: `portal-tabular`, `portal-sku`, `portal-h1/h2/h3`, `portal-body`, `portal-micro`, `portal-row`, `portal-focus`.

**Primitives** — `src/components/ui/`
- `status-dot.tsx`
- `money-cell.tsx` (USD/ARS dual con tooltip de FX)
- `stock-cell.tsx` (disponible + reservado + ETA, tono semántico)
- `tier-table.tsx` (tier actual destacado)

**Shell** — `src/components/portal/`
- `AppShell.tsx` (sidebar persistente desktop + drawer mobile)
- `SidebarNav.tsx` (6 áreas + sub-items)
- `TopBar.tsx` (Cmd-K, USD/ARS, crédito chip, notificaciones, tema, carrito)
- `CommandPalette.tsx` (Cmd-K — navegación + acciones rápidas)
- `CartSheet.tsx`

**Validación** — `src/pages/portal/StyleguidePage.tsx`
Ruta `/portal/__styleguide` (auth).

---

## ✅ Sprint 1 — AppShell + Sidebar + Sub-rutas (cerrado)

**Cambios**
- `src/pages/B2BPortal.tsx`: props nuevos `chrome?: "legacy" | "shell"` y `forcedTab?: PortalTab`. En `chrome="shell"` se omiten `PortalHeader` y la tabs bar; el `AppShell` provee chrome.
- `src/pages/portal/PortalRoot.tsx`: monta `AppShell` + `TopBar` + `<Outlet />` + `CommandPalette`.
- 14 wrappers en `src/pages/portal/`: HomePage, CatalogPage, BundlesPage, ConfiguratorPage, OrdersPage, QuotesPage, AccountPage, ProjectsPage, RmaPage, ApprovalsPage, InvoicesPage, BulkImportPage, ExpressQuotePage, SupportPage.
- `src/App.tsx`: nuevas rutas `/portal/*` (nested). Rutas legacy `/b2b-portal`, `/catalogo`, `/cotizaciones`, `/cotizador`, `/pagos`, `/armador-pc` preservadas.

**Cómo probar**
- `/portal` — home con shell.
- `/portal/catalogo` — catálogo con sidebar permanente.
- `/portal/pedidos` — pedidos.
- `/portal/cuenta/documentos` — facturas (sigue usando AccountCenter por dentro).
- Cmd/Ctrl + K — palette.
- `/b2b-portal?tab=catalog` — chrome legacy intacto.

**Done**: typecheck verde, build verde, sin regresiones esperadas en flujos cotización/pedido/catálogo.

---

## 🔜 Sprint 2 — Catálogo profesional (2 sem)

**Objetivo:** convertir `/portal/catalogo` en tabla densa con sidebar de categorías real, toolbar sticky, autocompletado, descarga de lista.

**Componentes nuevos** — `src/components/portal/catalog/`
- `CategorySidebar.tsx` — árbol con counts reales (RPC).
- `CatalogToolbar.tsx` — search + filtros chips + view toggle + ordenamiento + "Descargar lista".
- `CatalogTable.tsx` — usa `DataTableShell`, `StockCell`, `MoneyCell`, `TierTable` inline en hover/expand.
- `CatalogGrid.tsx` — vista alternativa.
- `SearchAutocomplete.tsx` — debounce 200 ms, top 10.
- `PriceListDownload.tsx` — botón con menú CSV/Excel.

**Modificados**
- `src/components/b2b/CatalogSection.tsx` — orquestador, delega rendering nuevo cuando ruta es `/portal/*`.
- `src/hooks/usePortalCatalog.ts` — expone `categoryCounts` desde RPC.
- `src/hooks/useCatalogSegments.ts` — árbol completo.

**Migraciones**
- `095_category_counts_rpc.sql` → `get_category_counts(p_client_id uuid)` retorna `{category_id, name, parent_id, count}`.
- `096_price_list_view.sql` → vista materializada `mv_price_list_per_client` (refresh nightly).

**Backend Fastify**
- `GET /v1/me/price-list?category=&format=csv|xlsx` con stream.
- `GET /v1/search?q=` con tsvector ranking.

**Done**
- Sidebar refleja counts reales del cliente.
- Toolbar mobile = bottom-sheet.
- Descarga CSV/XLSX con pricing personalizado.
- Autocomplete < 300 ms.
- Render virtualizado 60 fps con 5000 SKUs.

---

## 🔜 Sprint 3 — Ficha producto + Comparador (2-3 sem)

**Objetivo:** ficha real `/portal/p/:slug` con tabs y comparador de matriz.

**Componentes**
- `src/pages/portal/ProductDetailPage.tsx` (`/portal/p/:slug`).
- `src/pages/portal/CompareProductsPage.tsx` (`/portal/comparar?ids=`).
- `src/components/portal/product/`: `ProductGallery`, `ProductTabs`, `PriceTierTable`, `StockByWarehouse`.
- `src/components/portal/account/WatchlistPanel.tsx`.

**Modificados**
- `ProductDetailModal.tsx` → preview compacto en hover.
- `ComparisonBar.tsx` → linkea a `/portal/comparar`.

**Migraciones**
- `097_watchlist.sql` → `watchlist (id, profile_id, product_id, target_qty, created_at)` RLS por `profile_id`.
- `098_product_views_log.sql` → trigger para `RecentlyViewed`.
- Verificar/agregar `products.datasheet_url`, `products.images jsonb`.

**Done**
- `/portal/p/:sku` SSR-friendly (meta tags).
- Comparador 4 productos sin scroll horizontal en 1366.
- Watchlist persistente + notificación al volver stock.
- `PriceSparkline` carga historial real.

---

## 🔜 Sprint 4 — Home Dashboard + Recompra rápida (2 sem)

**Objetivo:** reemplazar `ClientDashboard` por `HomePage` con KPIs reales y recompra 1-click.

**Componentes**
- `src/components/portal/home/`: `HomeHero`, `MetricsRow`, `QuickActions`, `ForYouSection`, `ActivityFeed`, `AlertsInbox`.
- `src/components/portal/orders/RepeatOrderButton.tsx`.

**Modificados**
- `B2BPortal.tsx` — `forcedTab="home"` apunta a la nueva `HomePage` en lugar de `ClientDashboard`.
- `OrdersPanel.tsx` — agregar action "Reagregar".
- `useBusinessAlerts.ts` — read/dismiss.

**Migraciones**
- `099_business_alerts_read_log.sql` → `business_alerts_read (alert_id, profile_id, read_at)`.
- Vista materializada `mv_client_kpis(client_id, orders_in_progress, quotes_pending, last_invoice, credit_used_pct)` refresh c/5 min.

**Backend**
- `GET /v1/me/kpis` desde la vista materializada.

**Done**
- Home carga < 1.5 s.
- "Reagregar" arma carrito con validación de stock + diff de precios.
- Alertas marcables como leídas.

---

## 🔜 Sprint 5 — Documentos unificados + Reportes (2-3 sem)

**Objetivo:** una sección Documentos (factura/remito/NC/comprobante) y reportes con gráficos.

**Componentes**
- `src/pages/portal/account/DocumentsPage.tsx`
- `src/pages/portal/account/ReportsPage.tsx`
- `src/pages/portal/account/CreditPage.tsx`
- `src/components/portal/reports/`: `PurchasesByCategory`, `TopProducts`, `MonthlyTrend`, `YoYComparison`.

**Migraciones**
- `100_documents_unified_view.sql` — vista `v_client_documents (id, client_id, kind, number, date, amount, currency, status, pdf_url)`.
- `101_purchase_analytics_views.sql` — `mv_client_purchases_by_category`, `mv_client_top_products`, `mv_client_monthly_trend`.

**Backend**
- `GET /v1/me/documents`, `GET /v1/me/reports/purchases-by-category|top-products|monthly-trend`.

**Done**
- Documentos 12 meses sin lag.
- Export ZIP de PDFs.
- Reportes responden < 2 s.

---

## 🔜 Sprint 6 — Multi-usuario + Multi-sucursal + Aprobaciones (3 sem)

**Objetivo:** una empresa B2B = varios usuarios con roles + varias direcciones de envío + aprobación interna.

**Componentes**
- `/portal/cuenta/usuarios` — CRUD `b2b_users` con roles (`buyer`, `manager`, `admin`).
- `/portal/cuenta/sucursales` — CRUD `client_branches`.
- Banner "esperando aprobación" en `/portal/pedidos` para `buyer`.

**Migraciones**
- `b2b_users (id, client_id, profile_id, role, created_at)`.
- `client_branches (id, client_id, name, address, contact, default boolean)`.
- Trigger en `orders.insert` → `status='pending_approval'` si `total > buyer.approval_limit`.

**Backend**
- `POST /v1/clients/:id/users/invite` (email).
- `POST /v1/orders/:id/approve|reject`.

**Done**
- Manager invita buyer por email → buyer arma pedido > límite → manager recibe email + ApprovalsPanel → aprueba/rechaza → buyer ve estado.

---

## 🔜 Sprint 7 (opcional / largo plazo) — Multi-depósito + Tracking carrier

- Stock por depósito en `StockCell`.
- ETA real por carrier.
- Tracking events automáticos (Andreani, OCA).

---

## Arquitectura: decisiones diferidas (no bloqueantes)

Estas decisiones del plan original requieren más esfuerzo y se pueden encarar en Sprints posteriores:

- **Partir `B2BPortal.tsx` en sub-páginas reales** — hoy las nuevas rutas montan `B2BPortal` con `forcedTab`. Funciona, pero cada ruta carga el árbol entero. **Cuándo:** Sprint 4 (en paralelo con HomePage real, ya que se va a reemplazar `ClientDashboard`).
- **Partir `AccountCenter.tsx` en 14 sub-páginas reales** — hoy `AccountPage` apunta al tab `cuenta` y el sub-section vive en `?section=`. **Cuándo:** Sprint 5 (junto con `DocumentsPage`).
- **TanStack Query como cache global** — para que `useOrders` no recargue al cambiar de ruta. **Cuándo:** Sprint 4.
- **URL como fuente de verdad para filtros catálogo** — eliminar `localStorage` de view-mode y reemplazar por search params. **Cuándo:** Sprint 2.

## Verificación E2E (cada sprint)

1. `npm run build` sin warnings TS.
2. Login → Home → Catálogo → buscar SKU → agregar carrito → checkout 3 pasos → ver pedido en `/portal/pedidos`.
3. Login → Cotizaciones → crear → guardar → reabrir → convertir a pedido.
4. Login → Mi Cuenta → Documentos → filtrar por mes → descargar PDF.
5. Dark mode toggle revisar cada página nueva.
6. Mobile: drawer + search + carrito accesibles.
7. Lighthouse performance > 80 en home y catálogo.
