# Roadmap Bartez B2B

Hoja de trabajo viva con mejoras priorizadas para portal, admin y web pública.
Última actualización: 2026-05-15 (plan de sprints completo con los 30 items).

Cada item indica **impacto** (lo que cambia para el usuario o el equipo) y
**esfuerzo** estimado. Los items van marcándose con `[x]` al completarse.

---

## 🔴 Críticos — arquitectura y performance

Cosas que ya rompen experiencia o nos van a frenar cuando el proyecto crezca.

- [~] **1. Romper `Admin.tsx` (3072 líneas) en archivos por tab** _(parcial: extraídas 22 tabs comerciales a `AdminCommercialTabs.tsx`; 3072 → 2952 líneas)_
  Cada tab vive en su archivo y `Admin.tsx` solo orquesta. Reduce el blast
  radius de cualquier cambio y baja el costo de re-render.
  Tabs grandes (dashboard, products, orders, clients, kanban) quedan en
  Admin.tsx — extraerlas requiere extraer también su state compartido a un
  context o hook, trabajo de sesión dedicada.
  _Esfuerzo: alto · Impacto: alto (mantenibilidad)._

- [x] **2. `CartPage` no debe cargar el catálogo completo**
  `useProducts({ isAdmin })` trae todo el catálogo solo para mostrar el carrito
  y sugerencias. Cargar por IDs del carrito y diferir las sugerencias.
  _Esfuerzo: medio · Impacto: alto (TTI del carrito)._

- [~] **3. SalesDashboard recalcula 30+ memos en cada render** _(unificadas 7 iteraciones en una sola pasada `orderAggregates`; queda pendiente mover a vistas materializadas o web worker)_
  Pasar los cálculos pesados a vistas materializadas en Supabase o a un web
  worker. Con 10k pedidos se nota.
  _Esfuerzo: medio · Impacto: alto (FPS del dashboard)._

- [x] **4. Sacar `B2BPortal.tsx` del medio** _(5 de 7 sub-páginas migradas: Orders, Quotes, Rma, Projects, Invoices)_
  Hoy `OrdersPage`, `QuotesPage`, `RmaPage`, etc. son wrappers que renderizan
  `B2BPortal` entero con `forcedTab`. Cada subpágina debería ser standalone.
  Bundles y Configurator quedaron pendientes (lógica enredada con catálogo+carrito).
  _Esfuerzo: alto · Impacto: alto (carga y mantenibilidad)._

---

## 🟡 UX — faltan capas visibles

- [x] **5. Auto-save en formularios largos** _(hook creado, aplicado a CreateQuoteModal; ProductForm y CartPage ya tenían draft propio)_
  Hook `useFormDraft(key, state)` con debounce 2 s → `localStorage`. Aplicar
  a `ProductForm`, checkout del carrito, ClientCRM, cotización express.
  _Esfuerzo: bajo · Impacto: alto (cero pérdidas accidentales)._

- [x] **6. Notificaciones push reales para admin** _(hook `useAdminRealtimeAlerts`: orders INSERT/UPDATE + quotes INSERT)_
  Hoy `NotificationBell` lee la tabla pero no avisa en vivo. Suscribir a
  un canal Supabase realtime + toast al recibir pedido/cotización.
  _Esfuerzo: medio · Impacto: alto._

- [x] **7. Vista admin mobile (mínima)** _(AdminMobileQuickPanel en dashboard: 4 tiles + accesos rápidos)_
  Hoy el admin es desktop-only. Una vista chica con Dashboard + Pedidos +
  Cliente 360 + búsqueda alcanza para el 80% de los casos en la calle.
  _Esfuerzo: medio · Impacto: alto para vendedores en ruta._

- [ ] **8. Búsqueda global con `pg_trgm` / `tsvector`**
  `AdminSearch` hace `.includes()` en arrays en memoria. Reemplazar por
  búsqueda real en Postgres con índices.
  _Esfuerzo: medio · Impacto: alto en velocidad y precisión._

- [x] **9. Atajos de teclado en CommandPalette (`⌘K`)** _(chord `g h/c/o/q/a` para navegar sin abrir el palette)_
  Existe el palette pero está casi vacío. Poblar con: crear pedido (`⌘N`),
  buscar cliente, ir a tab X, sync proveedores, etc.
  _Esfuerzo: bajo · Impacto: alto para power users._

- [x] **10. Total flotante en el carrito mobile**
  Barra sticky bottom con subtotal + botón checkout. Hoy hay que scrollear.
  _Esfuerzo: muy bajo · Impacto: medio._

---

## 🟢 Polish — bajo esfuerzo, alto retorno

- [x] **11. Pre-cargar 5 tabs comunes del admin en idle**
  Con el `KeepAliveTab` actual, los tabs se montan al primera visita.
  Pre-montarlos (dashboard, products, orders, clients, quotes_admin) cuando
  el navegador esté idle.
  _Esfuerzo: bajo · Impacto: medio._

- [x] **12. Skeletons unificados** _(`<TabSkeleton variant="table|form|dashboard|cards|list|detail" />`; aplicado al Suspense de Admin)_
  Tres patrones distintos en el código (Skeleton, Loader2, nada). Definir
  `<TabSkeleton variant="table" | "form" | "dashboard" />` y aplicar.
  _Esfuerzo: bajo · Impacto: medio (sensación de pulido)._

- [x] **13. Empty states con CTA contextual** _(OrdersPanel, InvoicesPanel, SupportCenter ahora tienen CTA + description)_
  "No tenés pedidos aún. Empezá explorando el catálogo →". Hoy son frases
  secas sin acción.
  _Esfuerzo: bajo · Impacto: medio._

- [x] **14. Toasts con acción** _(patrón aplicado: RepeatOrderButton, RecurringOrdersPage)_
  Usar `sonner` con `action: { label, onClick }`. "Pedido creado" → ir al
  pedido. "Cliente guardado" → ver perfil.
  _Esfuerzo: bajo · Impacto: medio._

- [x] **15. Virtual scroll en `ProductTable` y `CatalogTable`** _(CatalogTable: activo desde 200 productos)_
  Con 5000 productos el scroll lagea. `@tanstack/react-virtual` resuelve.
  _Esfuerzo: medio · Impacto: medio-alto (depende del catálogo real)._

---

## 🆕 Features nuevas

- [x] **16. Comparador de productos accesible desde el catálogo** _(`useCompareList` hook + botón "Comparar" en CatalogTableRow expandida + ComparisonBar flotante)_
  Ya existe `CompareProductsPage` pero no hay botón "comparar" en cards/rows
  y no se ve un panel lateral con la selección actual.
  _Esfuerzo: medio · Impacto: medio._

- [x] **17. "Repetir pedido" en `/portal/pedidos`** _(ya estaba en `OrdersPanel`)_
  El botón ya existe (`RepeatOrderButton`) y se usa solo en Home. Hay que
  ponerlo en cada fila del listado de pedidos.
  _Esfuerzo: muy bajo · Impacto: medio (recompra fácil)._

- [~] **18. Compartir cotización por WhatsApp** _(MVP: botón WhatsApp en QuoteList con mensaje pre-armado; link público con OG image pendiente)_
  Link público `/q/:token` con preview (OG image). El cliente lo abre desde
  el celular sin loguearse.
  _Esfuerzo: medio · Impacto: alto comercialmente._

- [x] **19. Badges con métricas en vivo en el sidebar del portal**
  "Inicio (3)" si hay 3 pedidos pendientes, "Cotizaciones (1)" si hay una
  cotización por aprobar. La API del sidebar ya acepta `badge` pero nadie
  los puebla.
  _Esfuerzo: bajo · Impacto: medio._

- [x] **20. Modo foco para procesar pedidos rápido (admin)** _(`FocusModeQueue` integrado en ApprovalsTab: ↑↓ A R Espacio Esc)_
  Vista keyboard-only sobre la cola: ↑↓ navegar, A aprobar, R rechazar,
  espacio ver detalle. Para staff que despacha 50+ pedidos por día.
  _Esfuerzo: medio · Impacto: alto operativamente._

- [ ] **21. Templates de export por cliente**
  Algunos clientes corporativos piden la lista en su Excel propio. Sistema
  de templates configurable por cliente.
  _Esfuerzo: medio · Impacto: medio (depende de la cartera)._

- [x] **22. Audit log visible al cliente**
  "Pedido aprobado por Juan a las 10:32 / rechazado por crédito insuficiente".
  Hoy queda solo en el log interno del admin.
  _Esfuerzo: bajo · Impacto: medio (confianza/transparencia)._

- [x] **23. Sugerencias inline de precio por volumen en cart** _(hint click-to-fill en CartStep que muestra "+N u más ahorrás $X")_
  "Con 6 unidades pagás el tier y ahorrás $1.200". La lógica de tiers ya
  existe, falta la nota inline en cada línea del carrito.
  _Esfuerzo: bajo · Impacto: medio (sube ticket promedio)._

- [~] **24. Modo offline básico para vendedores en ruta** _(MVP: `useOnlineStatus` + `OfflineBanner` en portal; service worker + sync queue pendiente)_
  Service worker que cachea catálogo + clientes recientes + permite armar
  cotización offline → sync al recuperar red.
  _Esfuerzo: alto · Impacto: alto para vendedores que viajan._

---

## 🛠️ Calidad técnica

- [x] **25. Tests en código crítico de plata** _(48 tests nuevos: pricing, cartCheckout, useFormDraft)_
  `lib/pricing.ts`, `lib/cartCheckout.ts`, `hooks/usePricing.ts`, cálculo
  de IVA y tiers. Hoy hay 13 archivos test en todo el repo — ninguno toca
  cálculo de precios.
  _Esfuerzo: medio · Impacto: alto (regresiones silenciosas)._

- [x] **26. Quitar `console.log` / `console.error` en código de prod** _(50 llamadas migradas a `logger.*`; `info/debug` silenciados en prod)_
  11 archivos los tienen. Hook pre-commit que los bloquee + revisión.
  _Esfuerzo: muy bajo · Impacto: medio (perf + ruido en consola)._

- [x] **27. Error boundary en el portal**
  El admin lo tiene, el portal no. Si un componente del portal explota
  arrastra la app entera.
  _Esfuerzo: bajo · Impacto: alto cuando pasa._

- [x] **28. Eliminar `any` y casts laxos** _(AdminLayout.exchangeRate ahora es ExchangeRate)_
  `exchangeRate: any` en `AdminLayout`, varios `as Tab`. Tipar fuerte.
  _Esfuerzo: bajo · Impacto: alto en seguridad de cambios._

- [~] **29. Reducir bundle size** _(jsPDF ya no se carga con Admin shell — `exports.ts` queda detrás de `quotePdfClient.ts`/`exportPdf.ts` y `AdminCommercialTabs` usa `exportCsv.ts`)_
  Recharts, framer-motion, jsPDF, Radix entero cargan upfront. Lazy import
  de `jsPDF` y chunk separado para `recharts`.
  _Esfuerzo: medio · Impacto: medio en TTI._

- [ ] **30. Idempotencia en migraciones Supabase**
  Si corrés dos veces algunas migrations rompen. Marcar todas como
  idempotentes (`IF NOT EXISTS`, `DROP IF EXISTS`).
  _Esfuerzo: bajo · Impacto: alto operativamente cuando duele._

---

## Plan sugerido de ejecución

**Sprint 1 — wins rápidos (1 semana):**
Items de muy bajo/bajo esfuerzo que mejoran la experiencia visible de inmediato.

17 (repetir pedido) → 19 (badges en sidebar) → 22 (audit log al cliente) →
10 (total flotante mobile) → 14 (toasts con acción) → 9 (atajos CommandPalette) →
13 (empty states con CTA) → 23 (sugerencias de precio por volumen en cart) →
26 (quitar console.log en prod).

Resultado: portal se siente más "vivo" y útil sin gran obra. 9 items.

**Sprint 2 — estabilización UX y performance (1-2 semanas):**
Items de esfuerzo bajo/medio que eliminan fricciones concretas y lagueos visibles.

5 (auto-save formularios) → 2 (carrito sin catálogo completo) →
3 (SalesDashboard memos → Supabase views) → 15 (virtual scroll tablas) →
11 (idle preload tabs admin) → 12 (skeletons unificados) →
27 (error boundary portal) → 28 (eliminar `any`) → 30 (migraciones idempotentes).

Resultado: la app deja de perder datos, de lagear y de explotar en silencio. 9 items.

**Sprint 3 — refactor estructural (2-3 semanas):**
Items de esfuerzo alto que sanan la arquitectura y habilitan todo lo demás.

1 (romper Admin.tsx por tab) → 4 (portal pages standalone) →
8 (búsqueda global pg_trgm) → 25 (tests en código de precios) →
29 (reducir bundle size) → 16 (comparador de productos — botón faltante).

Resultado: base sana para escalar, código mantenible, búsqueda real. 6 items.

**Sprint 4+ — features de valor (ongoing):**
Items de esfuerzo medio/alto con alto retorno comercial u operativo, que requieren
la arquitectura del Sprint 3 como base.

6 (push realtime admin) → 18 (compartir cotización por WhatsApp) →
20 (modo foco admin keyboard-only) → 7 (vista admin mobile) →
21 (templates de export por cliente) → 24 (modo offline vendedores en ruta).

Resultado: diferenciadores reales para ventas y operaciones. 6 items.

---

## Cómo se mantiene este roadmap

- Cada commit que cierra un item lo marca con `[x]` y agrega comentario `· @PR-NN`.
- Al terminar un sprint, se mueven los completados a `ROADMAP-DONE.md` (por crear
  cuando haga falta) para mantener este archivo manejable.
- Items nuevos van al final de su sección, con la misma estructura (esfuerzo +
  impacto).
