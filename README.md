# Teqo · tienda

Tienda online de Teqo para consumidores finales de toda la Argentina: notebooks, gaming, monitores y periféricos.

Este repositorio nació como copia de [Bartez Tech Nexus](https://github.com/equazin/bartez-tech-nexus), el portal
mayorista. La rama `teqo` lo convierte en la tienda de Teqo fase por fase; el plan completo está en
[docs/plan-teqo-desde-bartez.md](docs/plan-teqo-desde-bartez.md). `main` sigue siendo Bartez y no se toca.

## Stack

- Vite + React 18 + TypeScript, React Router 7
- Tailwind 3 con los tokens de Teqo (Prisma × Central, tema nocturno) y shadcn/ui
- Supabase para acceso, datos, RLS y Storage (proyecto propio de Teqo)
- Funciones de Vercel en `api/*.ts` para checkout, pagos, emails y precios
- Vitest para pruebas unitarias

## Primer inicio

```bash
npm install
cp .env.example .env
npm run dev
```

La tienda queda en http://localhost:8080 y el panel en http://localhost:8080/admin.

## Variables de entorno

Están documentadas en `.env.example`. Los valores reales los carga Andrés en Vercel y en Supabase; nunca van al
repositorio.

## Scripts

- `npm run dev`: desarrollo local
- `npm run build`: build de producción
- `npm run preview`: vista previa del build
- `npm test`: pruebas de Vitest
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript
- `npm run check`: typecheck, lint, test y build

## Base de datos

Las migraciones viven en `supabase/migrations`, numeradas en orden (000 a 114; la 000 crea las tablas que Bartez había hecho a mano). Se aplican con `supabase db push`
contra el proyecto de Teqo. El proyecto depende de RPC y políticas RLS para la reserva atómica de stock, los
pedidos, los pagos y la auditoría.

## Despliegue

- Sitio y funciones en Vercel (región `gru1`), desde la rama `teqo`.
- Integración continua en `.github/workflows/ci.yml`: typecheck, lint, test y build.

## Reglas de interfaz

- Colores, tipografía, radios y espacios solo desde los tokens del tema (`src/index.css`, generado desde
  `src/tema/tokens.json`). Nada de colores hex en componentes de negocio.
- Contenedores: `SurfaceCard` para tarjetas y paneles; `EmptyState` para listados vacíos; `Badge` con variantes
  por tokens para estados.
- Acciones: `Button variant="default"` para la acción principal (rojo), `soft` para secundarias destacadas,
  `toolbar` para filtros y utilidades, `outline` para neutrales.

## Qué quedó hecho (fases 0 a 11 del plan)

- Tienda para el consumidor final en `src/pages/tienda` y `src/components/tienda`: inicio, categorías, fichas, búsqueda,
  carrito e invitado sin cuenta, checkout, compra por token, seguimiento, arrepentimiento, ayuda y páginas legales.
- Precios finales en pesos calculados en la base (`recalcular_precios`), con el dólar y el margen del panel; cuotas de
  Mercado Pago solo con sus datos (CFTEA y TEA).
- Pagos: Mercado Pago Checkout Pro con aviso firmado (`api/pagos.ts`) y transferencia confirmada desde el panel; un
  pedido se marca pagado solo por esos dos caminos. Envíos con una tarifa nacional por peso.
- Panel en modo tienda (`VITE_MODO_TIENDA=consumidor`): Dólar y margen, Envíos, Pagos, Transferencia y medios, Legal.
  El portal mayorista de Bartez se borró; las pestañas mayoristas vuelven con `VITE_MODO_TIENDA=mayorista`.
- Las rutas de la tienda (/api/checkout, /api/legal, /api/orders, /api/pagos y /api/precios) viven en `api/_tienda/` y salen
  por la función única `api/tienda.ts` con rewrites en vercel.json: el plan Hobby de Vercel admite 12 funciones por deploy.
- SEO: `npm run build` prerenderiza categorías y fichas (`scripts/prerender.mjs`) con datos estructurados y el sitemap.

Pendiente del plan: la fase 12 (corte y lanzamiento). Nada de esto se verificó con pruebas ni builds todavía:
antes de desplegar, correr `npm run check`. Las migraciones 000 a 115 ya están aplicadas en el proyecto `teqo` de Supabase (ref fvmdturspstoongbrtmc, región sa-east-1); las que se agreguen se aplican ahí con el MCP de Supabase o con `supabase db push`. La tienda está desplegada en Vercel como proyecto `teqo-tienda` (equipo equazins-projects), con la rama `teqo` como rama de producción y un guardia que salta los builds de cualquier otra rama: https://teqo-tienda.vercel.app. Las variables públicas, la clave de servicio de Supabase y CRON_SECRET ya están cargadas; faltan las de Mercado Pago (MERCADOPAGO_ACCESS_TOKEN y MERCADOPAGO_WEBHOOK_SECRET), el correo (SMTP_*, FROM_EMAIL, ADMIN_EMAIL) y, si se quiere, VERCEL_DEPLOY_HOOK_URL; las carga Andrés en Vercel › Settings › Environment Variables. El proyecto `bartez-tech-nexus` de Vercel sigue siendo Bartez y no se toca. Para correr la tienda en local: `cp .env.example .env`, cargar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (la URL y la clave pública del proyecto `teqo`), `npm install` y `npm run dev` (http://localhost:8080). La clave de servicio y las credenciales de Mercado Pago las carga Andrés en Vercel; nunca van al repositorio.
