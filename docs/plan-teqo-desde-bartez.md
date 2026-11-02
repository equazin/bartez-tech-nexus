# Plan de trabajo · Teqo a partir de Bartez

2 de noviembre de 2026 · Nico pidió el plan detallado para construir la tienda de Teqo a partir del código de
Bartez Tech Nexus (`equazin/bartez-tech-nexus`): que de Bartez pase a Teqo, con el mismo panel, y que el sitio
deje de ser un portal mayorista para ser una tienda para el consumidor final.

Este plan es el camino alternativo al monorepo actual (`equazin/teqo`). El relevamiento del mismo día
recomendó seguir con Teqo como está, porque ya tiene la vidriera, el motor con Mercado Pago y el panel propio.
El plan existe para comparar con números y para ejecutarlo si Nico lo decide. La sección 9 tiene la comparación.

## 1. Objetivo

- **Un repositorio nuevo** que nace de una copia de Bartez y termina siendo la tienda de Teqo: catálogo público,
  carrito e invitado sin cuenta, checkout con Mercado Pago y transferencia, envíos iguales a todo el país,
  arrepentimiento, seguimiento y el panel de administración de Bartez adaptado a vender a consumidores.
- **Cumplir las reglas fijas de Teqo** (CLAUDE.md): precios finales con IVA, contado y cuotas; pagado solo por aviso
  firmado de Mercado Pago; webhooks idempotentes; costo y margen nunca por la API pública; sin datos de tarjeta;
  sin retiro ni ciudad destacada; solo configuraciones de fábrica; botón de arrepentimiento sin registro.
- **Identidad Prisma × Central** en la tienda (tema nocturno, Space Grotesk y Chakra Petch, logotipo "teqo.")
  y el panel con el nombre y el logo nuevos.

## 2. Qué es Bartez hoy (relevamiento del 2/11/2026)

| Parte | Hoy en Bartez |
| --- | --- |
| Stack | Vite + React 18 sin render en servidor, React Router 7 en modo librería, shadcn/ui, Tailwind 3, Supabase (acceso, datos, RLS, 106 migraciones, 5 funciones Edge), funciones de Vercel en `api/*.ts` y un backend Fastify aparte (`equazin/bartez-backend`, `/v1/*`). Unas 103 mil líneas de TypeScript; 264 componentes, 46 páginas, 85 archivos en `lib` |
| Sitio público | Landing corporativa: formulario de contacto, calculadora de ahorro IT, industrias, clientes, metodología, preguntas. `/tecnologia` muestra el catálogo con un muro de login: los precios solo adentro del portal |
| Portal de clientes | `/portal/*` con cuenta obligatoria: catálogo, bundles, configurador, pedidos, aprobaciones, importación masiva, cotizaciones, proyectos, devoluciones, crédito, listas, reposición, sucursales, usuarios, reportes |
| Precios | Costo del proveedor (USD o ARS) por margen (`pricing_rules` por producto, cliente, categoría, proveedor, etiqueta o prefijo de SKU) y escalas por cantidad. El dólar vive en el navegador (`CurrencyContext`, valor por defecto 1300 en `localStorage`) y la moneda de un importe se adivina por su magnitud (`money.detectCurrency`) |
| Checkout | Exige usuario y perfil (`api/checkout.ts`). Medios: transferencia, echeq a 15, 30, 45 o 60 días, cuenta corriente, efectivo, otro. Envío: retiro en sucursal o Andreani, OCA, expreso, comisionista; costo por zona de código postal; gratis desde USD 800. Mercado Pago no aparece en ningún archivo |
| Panel | `/admin`, un solo `Admin.tsx` de 2.983 líneas con 50 pestañas en 10 grupos: Dashboard, Catálogo, Ventas, Vendedores, Clientes 360, Finanzas y docs, Marketing, Inventario, Configuración y Sistema. Cambiar el estado de un pedido, cupones y perfiles llaman a `bartez-backend` sin alternativa |
| Diseño | Tokens HSL en `src/index.css` (verde `152 56% 40%` como primario, Inter y Outfit desde Google Fonts). Fuera de `components/ui` hay 4.084 colores hex escritos a mano en 63 archivos, casi todos del panel |
| Marca | "Bartez" en 198 líneas de 69 archivos: `RouteSeo.tsx`, `index.html`, `sitemap.xml`, emails, PDF, prompts de IA, claves de `localStorage` |
| Datos públicos | La vista `portal_products` está concedida a `anon` y expone `cost_price` y `supplier_multiplier`: hoy el costo sale por la API pública |
| Salud | Sin integración continua (no hay `.github`). `npm run typecheck` falla (errores en `MarketingTab.tsx`), ESLint reporta 176 líneas, hay archivos de errores y pruebas sueltas subidos al repo. Migraciones con número repetido: 026, 044, 057, 058 y 079. Unas 137 pruebas de Vitest, varias sobre precios mayoristas |

## 3. Lo que se queda, lo que se cambia y lo que se tira

| Se queda tal cual | Se adapta | Se tira |
| --- | --- | --- |
| Supabase como base y acceso; migraciones 000 a 102 | Panel: nombre, logo, pestañas por modo, pestañas nuevas | Portal de clientes `/portal/*`, `components/b2b/*` y sus hooks |
| `components/ui/*` (shadcn), tema por tokens en `index.css` | Catálogo: componentes de `components/portal/catalog` y `product` pasan a rutas públicas | Páginas corporativas, formularios de contacto y cotización, calculadora |
| Importación de catálogo y precios, sincronización AIR y ELIT, buscador de imágenes, generador de contenido | Precios: de margen por cliente a precio final en pesos calculado en servidor | `CurrencyContext`, `detectCurrency`, escalas por cantidad en la tienda |
| Pedidos, stock con reserva atómica, movimientos, series, devoluciones, cupones | Checkout: de perfil obligatorio a invitado; medios por proveedor | Echeq, cuenta corriente, crédito, aprobaciones, acuerdos de precio, vendedores, altas B2B, reposición, listas, proyectos, sucursales |
| Emails (`api/email.ts`), WhatsApp, actividad, webhooks salientes | Envío: de zonas y transportes a una tarifa nacional por peso | `bartez-backend` (no se bifurca), cron de pedidos recurrentes, Google Ads por Edge Functions hasta decidir |

## 4. Decisiones que este plan toma (confirmar antes de empezar)

1. **Repositorio nuevo**, creado desde `bartez-tech-nexus@main` con el commit fijado. `equazin/teqo` queda congelado
   como referencia y como fuente de piezas (sección 8). Nombre propuesto: `equazin/teqo-tienda`.
2. **Proyecto nuevo de Supabase** para Teqo. Nunca la base de Bartez (`mfetwdftkiqydbwiqyfi`): son dos negocios,
   dos padrones de clientes y dos catálogos.
3. **Sin `bartez-backend`**: las llamadas que hoy no tienen alternativa pasan a las funciones de Vercel que ya existen.
   Un solo lugar para la lógica de servidor.
4. **Precios en servidor**: cada producto guarda su precio final en pesos, con IVA, calculado desde el costo, el dólar
   del panel y el margen por categoría o proveedor. La tienda nunca convierte moneda en el navegador.
5. **Invitado primero**: se compra sin cuenta. La cuenta del comprador es opcional y llega por enlace mágico.
6. **Render en servidor antes del lanzamiento** (fase 10) con React Router 7 en modo framework. Si se posterga,
   se lanza con prerender de inicio y categorías y SEO parcial.
7. **Mismo panel**: se conserva `Admin.tsx` y sus pestañas. No se repinta (los 4.084 hex quedan); solo cambian nombre,
   logo, fuente y qué pestañas se ven. Repintarlo con los tokens es un proyecto aparte de 1 a 2 semanas.
8. **Hosting**: Vercel (sitio y funciones) y Supabase. Railway no hace falta. Los crons son de Vercel.
9. **Nombres**: lo nuevo se escribe en español como en Teqo (`PasoEnvio`, `tarifas_envio`); lo heredado queda en
   inglés hasta que se toque.

## 5. Principios técnicos

| Principio | Cómo se aplica |
| --- | --- |
| Primero la fuga de datos | La fase 3 arranca quitando el costo de la vista pública, antes de publicar nada |
| Nada de precios en el cliente | El servidor resuelve precios, cupones, envío y stock en cada checkout; el navegador solo muestra |
| Pagado solo por aviso | Un pedido pasa a pagado únicamente en la función del webhook, con firma verificada y el pago consultado a Mercado Pago; la transferencia, por validación manual registrada |
| Idempotencia | Tabla `avisos_recibidos` con id externo único; dos avisos iguales no duplican nada |
| Costo y cotización del momento | Cada línea de pedido guarda costo, dólar e IVA del día de la venta (`order_items`); las métricas no recalculan con costos de hoy |
| Registro | `activity_logs` (existe) para precios, estados, validaciones manuales y reintegros |
| Pruebas | Vitest para precios, checkout, webhook y arrepentimiento; Playwright para la compra completa en staging; integración continua en cada PR |
| Marcadores | Textos legales, plazos, cuentas bancarias, teléfonos y datos de la empresa con [MARCADOR] hasta que Andrés los confirme |

## 6. Fases

### Fase 0 · Repositorio nuevo y base sana (1 PR)

- Crear el repo desde la copia de Bartez; `package.json` con nombre nuevo; borrar `lovable-tagger`.
- Limpiar lo que no va en un repo: `ts_errors*.txt`, `typecheck_*.txt`, `tsc_*.txt`, `lint_errors*.txt`,
  `build_log.txt`, `tmp_dribbble_ref.mp4`, `test-*.mjs`, `test-scrape.js`, `googleb35c341705ee78ca.html`,
  `google-ads-api-design-doc.html`, `.codex/`, `.continue/`.
- `npm run check` en verde: arreglar los tipos (`MarketingTab.tsx`: `percentage` contra `percent`, entre otros)
  y ESLint.
- Supabase nuevo: renumerar las migraciones repetidas (026, 044, 057, 058, 079) para que se apliquen en orden,
  aplicar 000 a 102 en una base vacía, crear los buckets `products`, `bundles` y `payment-proofs`,
  `config.toml` con `site_url` y redirecciones de Teqo. Probar `supabase db reset` en la integración continua.
- Vercel nuevo (región `gru1`), variables de entorno (Andrés carga los valores reales), `.env.example` documentado.
- `.github/workflows/ci.yml`: typecheck, lint, test y build en cada PR.
- README y CLAUDE.md nuevos con las reglas fijas de Teqo y los comandos.

**Terminada cuando** la integración continua pasa, el staging responde con la base nueva vacía y un administrador
invitado entra al panel.

### Fase 1 · De Bartez a Teqo (1 PR)

- Reemplazar las 198 menciones: `index.html` (título, canonical, descripción, `og:*`, sacar la verificación de
  Google y el `gtag` de Bartez), `RouteSeo.tsx` (`SITE_URL`, títulos), `public/sitemap.xml` y el `sitemap.xml`
  de la raíz (duplicado: queda uno), `site.webmanifest` (hoy sin nombre), `Footer.tsx`, `Navbar.tsx`,
  `api/email.ts` y `api/_shared/emailTemplates.ts` (remitente, firma), `api/ai.ts` (prompts), `exports.ts`,
  `exportClientData.ts`, `QuotePDF.tsx`, `OrderStatusTimeline.tsx`, `Login.tsx`, `ResetPassword.tsx`,
  `supabase/functions/generate-campaign`.
- Claves de `localStorage`: `bartez-theme`, `bartez_currency`, `bartez_exchange_rate` pasan a `teqo-*`
  (las dos últimas desaparecen en la fase 4).
- Contacto: `contacto@bartez.com.ar`, el WhatsApp `5493415104902` y los emails `pedidos@` pasan a [MARCADOR].
- Logos y favicon desde `brand/svg`, `brand/png` y `brand/favicon.ico` a `public/`: logotipo "teqo." y símbolo
  t con punto. Encendido no va en la tienda.

**Terminada cuando** `grep -ri bartez` en `src`, `api`, `public` y `supabase` devuelve cero.

### Fase 2 · Identidad Prisma × Central en código (1 PR)

- `scripts/generar-tema.mjs`: lee `src/tema/tokens.json` (copia de `packages/design-tokens/tokens.json` de Teqo)
  y escribe las variables HSL de `src/index.css`, porque Tailwind en Bartez usa `hsl(var(--x))`. Correspondencia:
  fondo → `background`; superficie → `card`, `popover`, `surface`; texto → `foreground`; texto secundario →
  `muted-foreground`; acento rojo `#E80B2A` → `primary`, `brand`, `ring`; éxito → `success`; error → `danger` y
  `destructive`; aviso → `warning`; borde → `border` e `input`. La tienda usa siempre el tema nocturno; el panel,
  el tema `panel` (mismos colores con DM Sans).
- Fuentes servidas desde la propia web: `brand/fonts/*.woff2` a `public/fonts`, `src/fuentes.css` con las
  `@font-face` (Space Grotesk variable, Chakra Petch 600 y 700, DM Sans 400, 500 y 700) y la precarga en
  `index.html`. Se saca el `@import` de Google Fonts de `index.css`.
- `tailwind.config.ts`: `sans` Space Grotesk, `display` Chakra Petch, `panel` DM Sans; `--radius` 12 px en botones
  y campos, 16 px en tarjetas (`rounded-2xl`), chips en píldora.
- `components/ui/button.tsx`, `badge.tsx`, `input.tsx`, `card.tsx`: radios y estados. Rojo solo en la acción
  principal y en titulares grandes; sobre grafito, el texto funcional en blanco.
- Panel: nombre, logo y DM Sans en `AdminSidebar.tsx` y `AdminTopbar.tsx`. Nada más.
- Página `/sistema-de-diseno` de muestra, como en Teqo, y la prueba de contraste de `packages/design-tokens`
  (`contraste.mjs`) adaptada.

**Terminada cuando** la muestra está aprobada por Nico, el contraste AA pasa y la tienda pública no tiene
colores fuera de los tokens.

### Fase 3 · Catálogo público (2 PR)

**PR 1 · Datos y rutas**

- Vista nueva `tienda_productos`, la única concedida a `anon`: `id`, `slug`, `display_name`, `description`,
  `images`, `category`, `brand_name`, `hay_stock`, `pocas_unidades`, `sku`, `iva_rate`, `precio_final_ars`,
  `precio_lista_ars`, `oferta`, `tags`, `weight_kg`, `featured`, `specs`. Nunca `cost_price`,
  `supplier_multiplier`, `price_tiers` ni `min_order_qty`. `REVOKE SELECT ON portal_products FROM anon`.
- Columnas en `products`: `slug` (único, desde el nombre y el SKU), `specs jsonb`, `images jsonb`
  (hoy hay una sola `image` y la tabla `image_suggestions`).
- Categorías públicas con slug desde las categorías internas (`category_mapping` sigue siendo la única fuente de
  verdad; `useCategoryTree` existe). RPC `tienda_categorias()`.
- Búsqueda con el `search_vector` de la migración 028: RPC `tienda_buscar(q)` sobre la vista.
- Rutas públicas: `/`, `/:categoria`, `/:categoria/:producto`, `/buscar?q=`. `/tecnologia` y `/productos`
  redirigen a `/` con 301.
- Prueba automática que consulta Supabase como `anon` y falla si aparece cualquier columna de costo.

**PR 2 · Pantallas**

- `src/components/tienda/Encabezado.tsx`, `BarraDeCategorias.tsx` y `Pie.tsx` reemplazan a `Navbar` y `Footer`
  en las rutas públicas: logotipo, búsqueda, carrito, cuenta; pie con datos legales y el botón de arrepentimiento.
- Inicio bloque por bloque según la maqueta `design/maquetas/propuestas/06-nocturno-prisma/` de Teqo: portada con
  `portada.jpg`, categorías, destacados (`products.featured`), Gaming con el titular "Más FPS. Menos excusas.",
  envíos y arrepentimiento, preguntas.
- Listado de categoría reusando `components/portal/catalog/*` (`CatalogGrid`, `FilterChips`, `SortMenu`,
  `SearchAutocomplete`, `CategorySidebar`) sin cuenta. Ficha con `ProductGallery` y `ProductTabs`; se quitan
  `PriceTierTable`, `StockByWarehouse` y `WatchlistPanel`. Solo configuraciones de fábrica: ningún "ampliar".
- Precio: contado final con IVA y "en N cuotas de $X" (la fase 4 pone los números reales).
- Se borran las páginas corporativas (`CorporateSolutions`, `ITServices`, `B2BSolutions`, `IndustrySolutions`,
  `PointOfSale`, `PointOfSaleSolutions`, `QuoteRequest`, `About`, `Contact`) y sus componentes
  (`HeroContactForm`, `ITSavingsCalculator`, `IndustriesServed`, `CorporateClients`, `EnterpriseCTA`,
  `WorkMethodology`, `CaseStudies`, `ClientLogos`, `ClientTestimonials`). Redirecciones 301 en `vercel.json`.

**Terminada cuando** un visitante sin cuenta navega categorías, busca y ve fichas con precio final, y la prueba
de `anon` pasa.

### Fase 4 · Precios finales en pesos (1 PR)

- Modelo: `products.precio_final_ars`, `products.precio_lista_ars` (el tachado de una oferta),
  `products.precio_manual boolean`, `products.precio_calculado_en`. Tabla `cotizacion_dolar`
  (`valor`, `fuente`, `vigente_desde`, `cargado_por`) con su pestaña Precios › Dólar en el panel.
- Cálculo en servidor (`api/precios.ts` y RPC `recalcular_precios()`): costo en la moneda del proveedor
  (`suppliers.source_currency`, migración 021) × dólar vigente × (1 + margen de `pricing_rules` por categoría o
  proveedor; las reglas por cliente dejan de aplicar) × (1 + `iva_rate` / 100), redondeado según
  [REGLA DE REDONDEO]. Se recalcula al cambiar el dólar, un costo o una regla, y en el cron diario de
  sincronización. `price_history` registra cada cambio.
- Cuotas: tabla `cuotas_config` (medio, cantidad, TEA, CFTEA, recargo) portada de
  `apps/motor/src/dominios/pagos/cuotas.ts` de Teqo, con su pestaña Precios › Comisiones. Ficha, carrito y
  checkout muestran contado y cuotas con TEA y CFTEA.
- Se eliminan `CurrencyContext`, `money.detectCurrency` y el selector de moneda del sitio público. El panel puede
  seguir mostrando el costo en su moneda.
- Pruebas: motor de precios con casos de consumidor; las pruebas mayoristas de `pricing.test.ts` se reescriben.

**Terminada cuando** todos los precios públicos salen de `precio_final_ars` y cambiar el dólar en el panel
actualiza la tienda.

### Fase 5 · Carrito y checkout de invitado (2 PR)

**PR 1 · Carrito**

- `src/lib/carrito.ts`: carrito en `localStorage` con un id anónimo; la tabla `carts` (existe) lo guarda para
  recuperarlo. `CartDrawer` adaptado. `/carrito` con contado, cuotas y envío estimado por código postal.

**PR 2 · Checkout**

- `/checkout` en cuatro pasos: datos (nombre, email, teléfono, documento opcional para la factura), envío
  (domicilio, código postal, provincia), pago (los medios activos) y confirmación. Sin registro. Al terminar,
  opción de crear la cuenta por enlace mágico de Supabase.
- `orders`: `customer_email`, `customer_name`, `customer_phone`, `customer_doc`, `shipping_address jsonb`
  (calle, número, piso, código postal, localidad, provincia), `access_token` único, `client_id` nulo para
  invitados. `order_items` (migraciones 068 y 072) guarda `unit_cost`, `exchange_rate` e `iva_rate` del momento.
- `api/checkout.ts`: deja de exigir perfil; acepta invitado con límite de tasa por IP y email; resuelve precios
  desde `precio_final_ars`, el envío desde `tarifas_envio` y el cupón desde `coupons` (036 y 037), todo en servidor;
  reserva stock con el RPC atómico existente; crea el pago pendiente; devuelve el `access_token`. Se restringe
  `Access-Control-Allow-Origin` al dominio propio.
- `/compra/:id?t=token` y `/seguimiento` (email y número de pedido), sin cuenta, por el RPC
  `pedido_por_token(id, token)` con `security definer`. `anon` nunca lee `orders` directo.
- Emails de compra recibida (fase 8 completa el resto).

**Terminada cuando** una compra de invitado termina en un pedido pendiente de pago con stock reservado, el email
sale una vez y la pantalla de compra se ve con el token.

### Fase 6 · Envíos iguales a todo el país (1 PR)

- Tabla `tarifas_envio` (rango de peso, precio final, demora en días) editable en Configuración › Envíos;
  envío gratis desde [MARCADOR], opcional.
- `src/lib/shipping.ts` se reemplaza: sin zonas por código postal, sin retiro en sucursal, sin transportes a
  elegir, sin el umbral en dólares. `ShippingStep` pasa a `PasoEnvio`: domicilio y un costo único por peso.
- `warehouses.allows_pickup` queda en falso; la interfaz no nombra ninguna ciudad.
- Después: Zipnova como proveedor intercambiable, portando cotización, etiqueta y seguimiento de `apps/motor`.

**Terminada cuando** el costo de envío no depende de la provincia ni de la ciudad y no hay texto de retiro en
ningún lugar público.

### Fase 7 · Pagos (2 PR)

**PR 1 · Proveedores y Mercado Pago**

- `src/lib/pagos/proveedores/` con la interfaz `ProveedorDePago` (crear intento, consultar estado, reintegrar) y
  la tabla `medios_de_pago` (medio, activo, orden, cuotas máximas). El checkout lista los activos; no conoce a
  ninguno por nombre.
- `api/pagos/mercadopago.ts`: crea la preferencia de Checkout Pro desde el servidor (`external_reference` = id
  del intento), `back_urls` a `/compra/:id`, `notification_url` al aviso.
- `api/pagos/mercadopago-aviso.ts`: verifica la firma `x-signature` con el secreto; registra el aviso en
  `avisos_recibidos` (`proveedor`, `id_externo` único); consulta el pago a la API de Mercado Pago y nunca confía
  en el cuerpo del aviso ni en la URL de vuelta; solo acá un pedido pasa a pagado. Responde 200 cuando quedó
  registrado; los errores van a `payments.error`.
- Se portan de Teqo `mercadopago.ts` (cliente sin SDK y estados), `conciliacion.ts` y `cobros.ts`.
- `payments` (080) suma `provider`, `external_id`, `installments`, `amount_cents` y los estados
  `pendiente`, `aprobado`, `rechazado`, `reintegrado`, `vencido`. Depósito y efectivo salen del checkout público
  y quedan para pedidos creados desde el panel.

**PR 2 · Transferencia y panel**

- Transferencia: datos de la cuenta en Configuración › Transferencia; vence a las [MARCADOR] horas con el cron
  `vencer-transferencias` como en Teqo; comprobante opcional en `payment-proofs`; validación manual en el panel
  como único camino a pagado para este medio, registrada en `activity_logs`.
- Reintegros desde el panel: por el proveedor (Mercado Pago) o manual (transferencia).
- Pestaña Ventas › Pagos: lista, estado, aviso recibido, reintegrar.
- Nunca se guardan datos de tarjeta. Secretos solo en variables de entorno de Vercel.

**Terminada cuando**, en staging con credenciales de prueba, una compra se marca pagada solo al llegar el aviso
firmado, dos avisos iguales no duplican nada y un aviso con firma inválida se rechaza (pruebas automáticas).

### Fase 8 · Pedidos, operación y emails (1 a 2 PR)

- Estados de consumidor: `pendiente_pago`, `pagado`, `preparando`, `enviado`, `entregado`, más `cancelado`,
  `reintegrado` y `vencido`. Transiciones en servidor en `api/orders.ts` (ya tiene `ALLOWED_TRANSITIONS` por rol).
- `patchOrder`, `patchProfile`, `createCoupon`, `updateCoupon`, `deleteCoupon` y el borrado de `useQuotes`
  llaman hoy a `bartez-backend` sin alternativa: pasan a `api/orders.ts`, `api/users.ts` y `api/pricing.ts`.
  `VITE_BACKEND_URL` y `src/lib/api/backend.ts` desaparecen.
- `OrderKanban.tsx` con las columnas nuevas; `OrderStatusTimeline` para el comprador; etiqueta y seguimiento con
  `shipping_provider` y `tracking_number` (035).
- Emails al comprador en `api/_shared/plantillas/`: compra recibida, pago acreditado, pedido enviado con
  seguimiento, entregado, transferencia por vencer, arrepentimiento recibido. Voz de `brand/VOZ-Y-CONTENIDO.md`,
  voseo, sin signos de exclamación en títulos. `order_email_logs` (079) evita reenviar.
- WhatsApp (`api/whatsapp-send.ts`) opcional, por configuración.

**Terminada cuando** el flujo pagado, preparando, enviado y entregado se opera desde el panel y cada paso manda
su email una sola vez.

### Fase 9 · Legal, arrepentimiento y ayuda (1 PR)

- Botón de arrepentimiento en el pie y en `/arrepentimiento`, visible desde el inicio y sin registro: número de
  pedido o email y motivo; tabla `arrepentimientos` (pedido, email, código, estado, creado_en, respondido_en);
  código al instante en pantalla y por email; plazo de 10 días corridos; pestaña Legal › Arrepentimientos con el
  plazo de respuesta resaltado. Se porta `apps/motor/src/dominios/arrepentimientos/`. Se quita la redirección de
  `/arrepentimiento` a `/` que hoy tiene `vercel.json`.
- Páginas `/ayuda` (envíos, pagos, garantías, contacto), `/terminos`, `/privacidad` y `/garantias` con
  [MARCADORES] donde falte el dato (razón social, CUIT, domicilio). Pie con los datos legales obligatorios y el
  enlace a Defensa del Consumidor.

**Terminada cuando** un cliente consigue su código de arrepentimiento sin cuenta y el panel lo ve.

### Fase 10 · SEO con render en servidor (1 a 2 PR)

- Hoy `RouteSeo` cambia el título en el cliente y los rastreadores ven un HTML vacío.
- React Router 7 en modo framework con el preset de Vercel (`@vercel/react-router`): `app/routes.ts`; loaders en
  servidor para `/`, `/:categoria`, `/:categoria/:producto`, `/buscar` y `/ayuda` (leen Supabase con la clave
  pública); `/admin`, `/carrito`, `/checkout` y `/compra` como rutas de cliente, sin render en servidor. Meta y
  canonical desde `meta()` de cada ruta; JSON-LD `Product`, `Offer` y `BreadcrumbList`.
- `api/sitemap.ts` genera el sitemap desde la base con categorías y productos activos.
- `Cache-Control` con revalidación corta en categoría y ficha.
- Alternativa si se posterga: prerender de inicio y categorías en el build y fichas como SPA.

**Terminada cuando** `curl` a una ficha devuelve HTML con título, precio y JSON-LD, y Lighthouse SEO da 90 o más.

### Fase 11 · Panel en modo tienda (1 a 2 PR)

- `adminNavConfig.ts` con `MODO_TIENDA=consumidor`: se ocultan Vendedores (las 5), Crédito, Aprobaciones,
  Altas B2B, Acuerdos Precio, Cotizaciones, POS, Bundles, Alertas B2B y Excepciones. Quedan Dashboard, Catálogo,
  Ventas (Pedidos, Kanban y Pagos), Clientes (compradores con cuenta e invitados agrupados por email), Finanzas,
  Marketing, Inventario, Configuración (Proveedores, Marcas, Precios, Comisiones, Dólar, Envíos, Transferencia,
  Medios de pago, Sync), Sistema y Legal (Arrepentimientos, Textos).
- `SalesDashboard`: ventas con el costo y la cotización guardados por línea; finanzas solo para administrador y
  nunca por la API pública.
- Se borran `src/pages/portal/*`, `src/components/b2b/*`, `src/components/portal/*` salvo `catalog/` y
  `product/`, y los hooks que solo ellos usaban (`useOrderApprovals`, `usePriceAgreements`, `useRecurringOrders`,
  `usePurchaseLists`, `useClientProjects`, `useB2BTeam`, `useClientBranches`, `useWatchlist`, entre otros).
  Las tablas quedan y se limpian después del corte. El cron de pedidos recurrentes se quita.
- `/login` y `/registrarse` pasan a ser solo del panel (`/panel/ingresar`); `Register.tsx` con CUIT desaparece;
  la cuenta del comprador vive en `/mi-cuenta` con enlace mágico.

**Terminada cuando** el panel muestra solo lo del modo tienda, el repo compila sin `components/b2b` y
`Admin.tsx` baja de 3.000 líneas.

### Fase 12 · Corte y lanzamiento (1 PR y tareas de hosting)

- Playwright en staging: compra completa con Mercado Pago de prueba, transferencia, seguimiento y
  arrepentimiento, en escritorio y móvil.
- Lista de corte: dominio y DNS, credenciales de producción de Mercado Pago (Andrés), dominio de email verificado
  (SPF y DKIM), medición (Google y Meta), textos legales sin [MARCADORES], catálogo real importado con
  `ProductImport` y `PriceStockImport`, copia de seguridad de Supabase, alertas de errores.
- Nota en el README de `equazin/teqo` apuntando al repo nuevo.

**Terminada cuando** la tienda vende en producción y la primera compra real pasa por el aviso firmado.

## 7. Orden y estimación

| Fase | PR | Semanas |
| --- | --- | --- |
| 0 · Repositorio y base sana | 1 | 0,5 a 1 |
| 1 · De Bartez a Teqo | 1 | 0,5 |
| 2 · Identidad en código | 1 | 0,5 a 1 |
| 3 · Catálogo público | 2 | 2 a 3 |
| 4 · Precios finales | 1 | 1 |
| 5 · Carrito y checkout | 2 | 2 |
| 6 · Envíos | 1 | 0,5 a 1 |
| 7 · Pagos | 2 | 2 |
| 8 · Pedidos y emails | 1 a 2 | 1 a 2 |
| 9 · Legal | 1 | 0,5 a 1 |
| 10 · SEO | 1 a 2 | 1 a 2 |
| 11 · Panel modo tienda | 1 a 2 | 1 |
| 12 · Corte | 1 | 0,5 a 1 |
| **Total** | **16 a 19** | **13 a 18** |

Una persona, de corrido: entre tres y cuatro meses y medio hasta vender. Las fases 0 a 2 van en orden; 3 y 4
juntas; 5, 6 y 7 en orden; 8 y 9 pueden ir en paralelo; 10 y 11 en cualquier orden antes del corte.

## 8. Qué se porta desde el repositorio de Teqo

| Pieza | Origen en `equazin/teqo` | Destino | Fase |
| --- | --- | --- | --- |
| Tokens y fuentes | `packages/design-tokens/tokens.json`, `brand/fonts` | `src/tema/`, `public/fonts` | 2 |
| Maqueta y portada | `design/maquetas/propuestas/06-nocturno-prisma/`, `apps/storefront/public/portada/portada.jpg` | referencia e inicio | 3 |
| Cuotas con TEA y CFTEA | `apps/motor/src/dominios/pagos/cuotas.ts` | `cuotas_config`, `src/lib/precios/cuotas.ts` | 4 |
| Mercado Pago sin SDK, conciliación, cobros | `apps/motor/src/dominios/pagos/mercadopago.ts`, `conciliacion.ts`, `cobros.ts` | `api/pagos/*`, `src/lib/pagos/proveedores/` | 7 |
| Vencimiento de transferencias | tarea `vencer-transferencias` del motor | `api/cron/vencer-transferencias.ts` | 7 |
| Arrepentimientos | `apps/motor/src/dominios/arrepentimientos/` | tabla y pestaña | 9 |
| Zipnova | dominio de envíos del motor | proveedor de envío | después |
| Voz y textos | `brand/VOZ-Y-CONTENIDO.md`, `docs/especificacion.md` secciones 6 y 9 | emails, ayuda, legales | 8 y 9 |
| Validación de entradas | esquemas de `packages/contrato` | `api/_shared/schemas.ts` (ya usa zod) | 5 y 7 |

## 9. Comparación con seguir en `equazin/teqo`

| | Desde Bartez | Teqo como está |
| --- | --- | --- |
| Hasta vender | 13 a 18 semanas | Lo que queda de la etapa 9, las partes 2 a 5 del rediseño (4 PR) y la etapa 10 del corte (1 a 2 PR): 5 a 8 semanas |
| Catálogo, carrito, checkout, compra, seguimiento, arrepentimiento | Se construyen | Hechos |
| Mercado Pago por aviso firmado, cuotas, transferencia, reintegros, Zipnova | Se portan | Hechos |
| Render en servidor y SEO | Migración a modo framework | Next.js, hecho |
| Panel | 50 pestañas en un archivo, pintado a mano; se podan 14 y se suman 8 | Unas 50 pantallas por fases, con tokens |
| Importación de catálogo, proveedores por API, buscador de imágenes | Hechos en Bartez | Hechos en Teqo (planilla, mayoristas por API, fotos de la web oficial) |
| Lo que Bartez tiene y Teqo no | Kanban, reglas de precios, bundles, campañas de Google Ads, webhooks salientes, devoluciones, series | Se portan de a una al panel propio si hacen falta |

## 10. Riesgos y cómo se cubren

| Riesgo | Cómo se cubre |
| --- | --- |
| El costo sale hoy por `portal_products` a `anon` | Primer cambio de la fase 3; prueba automática como `anon` en cada PR |
| Precios en el navegador con dólar en `localStorage` y moneda adivinada por magnitud | La fase 4 los elimina; no se publica nada antes |
| `Admin.tsx` de 3.000 líneas y 4.084 hex | No se toca más que para podar pestañas; repintar queda como proyecto aparte |
| Pedidos, cupones y perfiles dependen de `bartez-backend` | La fase 8 los pasa a las funciones de Vercel; hasta entonces el staging no cambia estados |
| Migraciones con número repetido | La fase 0 renumera y la integración continua hace `db reset` |
| Sin render en servidor | Fase 10; si se posterga, prerender de inicio y categorías |
| `api/checkout.ts` con origen `*` y clave de servicio | La fase 5 restringe el origen, valida con zod y limita la tasa |
| Políticas RLS pensadas para mayoristas | Auditoría en la fase 5: `anon` no lee `orders`, `profiles` ni `products` crudos |
| Dos repos vivos: Bartez sigue cambiando | No hay merge hacia atrás; lo que convenga se porta a mano y se anota en el README |
| Pruebas mayoristas que dejan de aplicar | Se reescriben en las fases 4 y 5; cobertura mínima del 80 % en precios, checkout y pagos |

## 11. Decisiones abiertas

1. Nombre y lugar del repositorio nuevo: repo aparte (propuesto) o carpeta dentro del monorepo.
2. Qué pasa con `equazin/teqo`: congelado como referencia (este plan) o seguir ahí (la recomendación del relevamiento).
3. Cuenta del comprador al lanzamiento: solo invitado, o cuenta opcional desde el primer día.
4. Envíos al lanzamiento: tarifa nacional por peso (este plan) o Zipnova desde el inicio.
5. Render en servidor antes o después del lanzamiento.
6. Cupones al lanzamiento.
7. Proveedores por API: sirven AIR y ELIT de Bartez, o se portan los conectores de la etapa 6b de Teqo.
8. Facturación: Andrés factura con su sistema actual; la pestaña Facturas de Bartez (migración 033) queda
   informativa o se oculta.
9. Repintar el panel con los tokens (1 a 2 semanas) o dejarlo como está.
10. Google Ads y generación de contenido por Edge Functions: se mantienen, se portan a funciones de Vercel o salen.
