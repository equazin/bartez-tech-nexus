-- Sincronización automática: dos veces por día (9 y 18, hora de Argentina) el cron de Vercel trae el dólar
-- del BNA, los costos y el stock de ELIT, y recalcula los precios. La configuración y el resultado de la
-- última corrida quedan en tienda_configuracion para verlos y cambiarlos desde el panel (Precios › Dólar).

insert into public.tienda_configuracion (clave, valor, descripcion)
values
  ('dolar_automatico', '{"activo": true, "tipo": "billete"}'::jsonb,
   'Dólar automático del Banco Nación: activo y qué cotización de venta se toma (billete o divisa).'),
  ('sincronizacion_elit', '{"activa": true}'::jsonb,
   'Costos y stock de ELIT dos veces por día.'),
  ('sincronizacion_ultima', '{}'::jsonb,
   'Resultado de la última sincronización automática (la escribe el servidor).')
on conflict (clave) do nothing;

-- Pasa a cada producto el costo y el stock de sus proveedores, con la misma regla que la sincronización
-- del panel en modo "solo precios": el costo de la fila activa más barata y el stock neto de las filas
-- activas. products.stock_reserved no se toca: lo manejan los pedidos de la tienda.
create or replace function public.reconciliar_costos_y_stock(p_ids integer[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cambiados integer;
begin
  with elegido as (
    select distinct on (ps.product_id) ps.product_id, ps.cost_price
    from public.product_suppliers ps
    where ps.product_id = any (p_ids)
    order by ps.product_id, (not ps.active), ps.cost_price, ps.id
  ),
  neto as (
    select ps.product_id, greatest(0, coalesce(sum(ps.stock_available), 0) - coalesce(sum(ps.stock_reserved), 0))::integer as stock
    from public.product_suppliers ps
    where ps.active and ps.product_id = any (p_ids)
    group by ps.product_id
  )
  update public.products p
  set cost_price = e.cost_price,
      stock = coalesce(n.stock, 0),
      updated_at = now()
  from elegido e
  left join neto n on n.product_id = e.product_id
  where p.id = e.product_id
    and (p.cost_price is distinct from e.cost_price or coalesce(p.stock, 0) <> coalesce(n.stock, 0));

  get diagnostics v_cambiados = row_count;
  return v_cambiados;
end;
$$;

revoke all on function public.reconciliar_costos_y_stock(integer[]) from public, anon, authenticated;
grant execute on function public.reconciliar_costos_y_stock(integer[]) to service_role;
