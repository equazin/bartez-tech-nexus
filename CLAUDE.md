# Teqo — tienda online (a partir de Bartez)

Tienda propia de notebooks, gaming, monitores y periféricos para consumidores finales de toda la Argentina.
Solo online: la propuesta es la misma para todo el país. Expresión de marca: "Subí tu mundo."

Este repositorio nació como copia de Bartez Tech Nexus (portal mayorista). La rama `teqo` lo convierte en la
tienda de Teqo siguiendo `docs/plan-teqo-desde-bartez.md`, fase por fase. Lo heredado de Bartez queda en inglés
hasta que se toca; lo nuevo se escribe en español.

## Documentos de referencia
- Plan de trabajo: docs/plan-teqo-desde-bartez.md (fases, archivos, modelos, rutas, decisiones abiertas).
- Especificación, identidad y maquetas: en el repositorio `equazin/teqo` (docs/especificacion.md, brand/,
  design/maquetas/propuestas/06-nocturno-prisma/). Los tokens y las fuentes se copian a este repo (src/tema, public/fonts).

## Stack
- Vite + React 18 + TypeScript, React Router 7, Tailwind 3 con los tokens de Teqo, shadcn/ui.
- Supabase (proyecto propio de Teqo): acceso, datos, RLS y Storage. Migraciones en supabase/migrations.
- Funciones de Vercel en api/*.ts para todo lo que corre en servidor (checkout, pagos, emails, precios). No hay backend aparte.
- Pruebas: Vitest. Hosting: Vercel.

## Reglas fijas
- Interfaz, errores y emails en español rioplatense, con voseo. Sin signos de exclamación en títulos, sin emojis,
  sin superlativos que no se puedan probar.
- Colores, tipografía, espacios y radios solo desde los tokens (Prisma × Central: rojo #E80B2A, grafito y grises).
  El rojo marca la acción principal y no compite en todo; sobre grafito, el texto funcional va en blanco y el rojo
  solo en titulares grandes. Fuentes servidas desde la propia web.
- Envíos iguales para todo el país: nada de entrega en el día, moto ni retiro en una ciudad, y la interfaz no
  destaca ninguna ciudad.
- Precios siempre finales con IVA incluido; mostrar contado y cuotas. Se calculan en servidor, nunca en el navegador.
- Solo configuraciones de fábrica: nunca ofrecer ampliar memoria o disco.
- Un pedido se marca pagado SOLO por webhook firmado y verificado de Mercado Pago (o por validación manual
  registrada, para transferencias).
- Webhooks idempotentes: el mismo aviso dos veces no duplica nada.
- Pagos: cada medio es un proveedor intercambiable que se activa por configuración; el checkout no depende de
  ninguno por nombre.
- Nunca guardar datos de tarjeta. Secretos solo en variables de entorno (.env.example documentado). Los valores
  reales los carga Andrés en el hosting; nunca se suben al repositorio ni se piden por el chat.
- Costo y margen nunca salen por la API pública; las pantallas de finanzas son solo para administrador.
- Cada línea de pedido guarda el costo y la cotización del momento de la venta; las métricas nunca recalculan
  ventas pasadas con costos de hoy.
- Botón de arrepentimiento visible desde el inicio, sin registro, con código al instante.
- No inventar precios, textos legales, plazos ni datos de productos: usar [MARCADORES].

## Cómo trabajamos
- Una fase del plan por vez, en orden; un commit por fase o por PR del plan, en la rama `teqo`.
- `main` y la web de Bartez no se tocan.

## Comandos
- Instalar: `npm install` (Node 22)
- Desarrollo: `npm run dev` (http://localhost:8080)
- Chequeos: `npm run check` (typecheck, lint, test y build)
- Migraciones: `supabase db push` contra el proyecto de Teqo
