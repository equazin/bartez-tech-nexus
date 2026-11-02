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

Las migraciones viven en `supabase/migrations`, numeradas en orden (000 a 105). Se aplican con `supabase db push`
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
