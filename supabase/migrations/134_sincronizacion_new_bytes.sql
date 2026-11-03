-- New Bytes entra en la sincronización automática de las 9 y las 18 (api/_tienda/sincronizacion.ts):
-- costos y stock de los productos vinculados, con un interruptor propio en Precios › Dólar.
insert into public.tienda_configuracion (clave, valor, descripcion)
values ('sincronizacion_newbytes', '{"activa": true}'::jsonb, 'Costos y stock de New Bytes dos veces por día.')
on conflict (clave) do nothing;
