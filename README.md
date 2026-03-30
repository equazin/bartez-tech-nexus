# Bartez Tech Nexus

Portal comercial y operativo de Bartez para venta B2B, gestion administrativa y sincronizacion con Supabase/Vercel.

## Stack

- Vite + React + TypeScript
- Tailwind + shadcn/ui
- Supabase para auth, datos, RPCs y RLS
- Vercel Functions para integraciones server-side
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
- `vercel.json` reescribe las rutas SPA y expone `api/*.ts`
- Las funciones usan `maxDuration` de 30s

## Calidad actual

Antes de abrir un deploy o PR:

```bash
npm run check
```

## Notas

- El package manager oficial del repo es `npm`
- Las variables server-side deben vivir en Vercel/entorno local, no en el cliente
