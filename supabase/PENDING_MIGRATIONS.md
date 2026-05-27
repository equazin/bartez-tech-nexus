# Migraciones pendientes de aplicar

Ejecutar cada SQL desde el dashboard de Supabase
(SQL Editor → New query → pegar contenido → Run) en este orden:

| # | Archivo | Qué agrega | Riesgo |
|---|---------|-----------|--------|
| 103 | `migrations/103_client_export_templates.sql` | Tabla `client_export_templates` + RLS + 3 templates seed | Bajo (sólo crea) |
| 104 | `migrations/104_admin_global_search.sql` | Extensión `pg_trgm` + 5 índices GIN + RPC `admin_global_search` | Medio (crea índices grandes, primera ejecución puede tardar) |
| 105 | `migrations/105_quote_public_share.sql` | Columna `quotes.public_token` + RPCs `issue_quote_public_token` / `get_public_quote` / `mark_quote_viewed` | Bajo |
| 106 | `migrations/106_sales_dashboard_summary.sql` | Vista materializada `mv_sales_dashboard_summary` + RPCs `get_sales_dashboard_summary` / `refresh_sales_dashboard_summary` | Bajo |

Todas son **idempotentes** — si las corrés dos veces no rompen.

## Verificación post-aplicación

```sql
-- 103
SELECT slug, name FROM client_export_templates ORDER BY name;
-- Debe devolver: default, in_stock_only, minimal

-- 104
SELECT * FROM admin_global_search('cable', 3);
-- (Requiere rol admin/vendedor del usuario auth.uid())

-- 105
SELECT proname FROM pg_proc
  WHERE proname IN ('issue_quote_public_token', 'get_public_quote', 'mark_quote_viewed');
-- 3 filas

-- 106
SELECT * FROM mv_sales_dashboard_summary;
SELECT get_sales_dashboard_summary();
```

## Refresh periódico recomendado

`mv_sales_dashboard_summary` se popula al crearse. Para que el dashboard
muestre métricas frescas hay 2 opciones:

1. **On-demand** (ya implementado): el botón "Refrescar" del dashboard llama
   a `refresh_sales_dashboard_summary()`.
2. **Programado** (recomendado): instalar `pg_cron` y agregar:

```sql
SELECT cron.schedule(
  'refresh_sales_dashboard',
  '*/15 * * * *',
  $$ REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_dashboard_summary; $$
);
```

`mv_price_list_per_client` (de migración 096) también conviene refrescar
cada hora si los precios cambian seguido.
