# Bartez Tech Nexus

Portal comercial y operativo de Bartez para venta B2B, gestion administrativa y sincronizacion con Supabase/Vercel.

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase para auth, datos, RPCs y RLS
- `bartez-backend` para la API de negocio principal (`/v1/*`)
- Vercel Functions solo para integraciones legacy/server-side que todavia no migraron
- Vitest para pruebas unitarias

## Modulos principales

- Sitio corporativo y landing comercial
- Portal B2B para clientes autenticados
- Backoffice administrativo con stock, pedidos, clientes y reportes
- Cotizaciones, invoices y reglas de pricing
- Integracion con AIR y correo transaccional

## Requisitos

- Node.js 20+
- npm 10+

## Primer inicio

```bash
npm install
npm run dev
```

## Variables de entorno

Copiar `.env.example` y completar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AIR_API_URL`
- `AIR_API_TOKEN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `FROM_EMAIL`
- `ADMIN_EMAIL`

## Scripts

- `npm run dev`: desarrollo local
- `npm run build`: build de produccion
- `npm run preview`: preview local del build
- `npm run test`: suite de Vitest
- `npm run lint`: chequeos de ESLint
- `npm run typecheck`: chequeos de TypeScript
- `npm run check`: typecheck + lint + test + build

## Base de datos

Las migraciones viven en [`supabase/migrations`](C:/Users/nicop/OneDrive/Documentos/git/bartez-tech-nexus/supabase/migrations). El proyecto depende de RPCs y politicas RLS para:

- reserva atomica de stock
- credito por cliente
- cotizaciones e invoices
- auditoria de stock

## Deploy

- Frontend estatico servido en Vercel
- API principal servida por el repo [`bartez-backend`](https://github.com/equazin/bartez-backend)
- `VITE_BACKEND_URL` debe apuntar al backend Fastify en cada entorno
- `api/*.ts` queda como capa legacy para integraciones que todavia no viven en el backend separado

## Calidad actual

Antes de abrir un deploy o PR:

```bash
npm run check
```

## Notas

- El package manager oficial del repo es `npm`
- Las variables server-side deben vivir en Vercel/entorno local, no en el cliente

## Reglas UI y theming

- No hardcodear colores en componentes de negocio. Usar tokens Tailwind del tema: `bg-background`, `bg-card`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border/70`.
- Contenedores principales: usar `SurfaceCard` para cards, paneles internos y bloques expandibles. Evitar repetir `div rounded-xl border p-*`.
- Acciones:
  - `Button variant="default"` para CTA principal.
  - `Button variant="soft"` para tabs activas o acciones secundarias destacadas.
  - `Button variant="toolbar"` para filtros, toggles y utilidades de header.
  - `Button variant="outline"` para acciones neutrales o destructivas suaves.
- Estados vacios: usar `EmptyState` en tablas y listados. No dejar textos sueltos centrados sin estructura.
- Estados de dominio: usar `Badge` con variantes y clases basadas en tokens (`success`, `warning`, `danger`, `muted`), no spans con colores hex.
- Filas expandibles y tablas custom: hover con `hover:bg-secondary/50`, fila activa con `bg-secondary/60`, separadores con `border-border/70`.
- Inputs y selects: `bg-card` + `border-border/70` + `focus:border-primary/40`. No usar helpers `dk()` ni clases condicionadas con hex.
- Si un modulo nuevo necesita layout de dashboard, partir desde el shell admin existente y reutilizar la misma escala de espaciado (`gap-3`, `gap-4`, `rounded-xl`, `rounded-2xl`).
