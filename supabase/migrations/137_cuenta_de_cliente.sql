-- 137 · Mi cuenta de la tienda: ingreso con código por email, mis compras, mis datos, facturas en PDF y el
-- cupón para la próxima compra, que se activa en la cuenta del email de la compra.
--
-- Antes de abrir el registro de clientes se cierran permisos heredados del portal mayorista:
--   · el rol de un usuario nuevo salía de los metadatos que manda el navegador (cualquiera podía registrarse admin);
--   · cada usuario podía cambiar su propio rol desde el navegador (profiles_update_own sin límite de columnas);
--   · cualquier usuario con sesión leía los costos de los mayoristas (product_suppliers), los avisos por email de
--     los pedidos y la configuración de la tienda, y podía crear pedidos propios sin pasar por el checkout;
--   · los cupones activos se podían listar sin sesión.

-- 1. El rol (y el margen y el tipo de cliente) solo los pone el servidor, en app_metadata.
CREATE OR REPLACE FUNCTION public.handle_auth_user_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role   TEXT;
  v_margin NUMERIC;
  v_tipo   TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_role   := COALESCE(NULLIF(NEW.raw_app_meta_data->>'role', ''), 'client');
    IF v_role NOT IN ('client', 'cliente', 'admin', 'vendedor') THEN
      v_role := 'client';
    END IF;
    v_margin := public.safe_to_numeric(NEW.raw_app_meta_data->>'default_margin', 20.0);
    v_tipo   := COALESCE(NULLIF(NEW.raw_app_meta_data->>'client_type', ''), 'mayorista');
    IF v_tipo NOT IN ('mayorista', 'reseller', 'empresa') THEN
      v_tipo := 'mayorista';
    END IF;

    INSERT INTO public.profiles (
      id, email, phone, company_name, contact_name, client_type, default_margin, role, active, estado, precio_lista
    )
    VALUES (
      NEW.id,
      NEW.email,
      LEFT(COALESCE(NEW.raw_user_meta_data->>'phone', ''), 40),
      LEFT(COALESCE(NEW.raw_user_meta_data->>'company_name', ''), 160),
      LEFT(COALESCE(NEW.raw_user_meta_data->>'contact_name', ''), 160),
      v_tipo,
      v_margin,
      v_role,
      true,
      'activo',
      CASE WHEN v_role = 'admin' THEN 'standard' ELSE 'mayorista' END
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email          = EXCLUDED.email,
      phone          = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE profiles.phone END,
      company_name   = CASE WHEN EXCLUDED.company_name <> '' THEN EXCLUDED.company_name ELSE profiles.company_name END,
      contact_name   = CASE WHEN EXCLUDED.contact_name <> '' THEN EXCLUDED.contact_name ELSE profiles.contact_name END,
      default_margin = EXCLUDED.default_margin,
      role           = EXCLUDED.role,
      updated_at     = now();

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.profiles
       SET email      = NEW.email,
           updated_at = now()
     WHERE id = NEW.id
       AND (email IS NULL OR email <> NEW.email);
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Desde el navegador, un usuario que no es admin solo cambia su teléfono, nombre y empresa.
CREATE OR REPLACE FUNCTION public.perfil_sin_escalar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v public.profiles;
BEGIN
  -- El servidor (service_role) y las funciones del sistema pasan; el filtro es para las sesiones del navegador.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF lower(COALESCE(public.get_my_role(), '')) = 'admin' THEN
    RETURN NEW;
  END IF;
  v := OLD;
  v.phone        := LEFT(COALESCE(NEW.phone, ''), 40);
  v.contact_name := LEFT(COALESCE(NEW.contact_name, ''), 160);
  v.company_name := LEFT(COALESCE(NEW.company_name, ''), 160);
  v.updated_at   := now();
  RETURN v;
END;
$function$;

DROP TRIGGER IF EXISTS perfil_sin_escalar ON public.profiles;
CREATE TRIGGER perfil_sin_escalar
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.perfil_sin_escalar();

-- 3. Pedidos: la tienda los crea por el checkout (servidor); desde el navegador solo el equipo.
DROP POLICY IF EXISTS orders_insert_own ON public.orders;
DROP POLICY IF EXISTS orders_update_own ON public.orders;
DROP POLICY IF EXISTS orders_insert_staff ON public.orders;
CREATE POLICY orders_insert_staff ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (lower(COALESCE(public.get_my_role(), '')) = ANY (ARRAY['admin', 'vendedor']));

-- 4. Los cupones se validan en el servidor: nadie los lista desde el navegador salvo el admin.
DROP POLICY IF EXISTS "Clients read active coupons" ON public.coupons;

-- 5. Costos de los mayoristas, avisos por email y configuración: solo el equipo.
DROP POLICY IF EXISTS ps_select_authenticated ON public.product_suppliers;
DROP POLICY IF EXISTS ps_select_panel ON public.product_suppliers;
CREATE POLICY ps_select_panel ON public.product_suppliers
  FOR SELECT TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = ANY (ARRAY['admin', 'vendedor', 'sales']));

DROP POLICY IF EXISTS "Admins and users can view order email logs" ON public.order_email_logs;
DROP POLICY IF EXISTS order_email_logs_panel ON public.order_email_logs;
CREATE POLICY order_email_logs_panel ON public.order_email_logs
  FOR SELECT TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = ANY (ARRAY['admin', 'vendedor', 'sales']));

DROP POLICY IF EXISTS tienda_configuracion_leer ON public.tienda_configuracion;
CREATE POLICY tienda_configuracion_leer ON public.tienda_configuracion
  FOR SELECT TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = ANY (ARRAY['admin', 'vendedor', 'sales']));

-- 6. El email confirmado de la sesión: con él se reconocen las compras (también las hechas como invitado).
CREATE OR REPLACE FUNCTION public.tienda_email_de_la_sesion()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
$function$;

-- 7. Datos del cliente para completar el checkout: cada uno ve y cambia solo los suyos.
CREATE TABLE IF NOT EXISTS public.tienda_clientes (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre         text CHECK (nombre IS NULL OR length(nombre) <= 120),
  telefono       text CHECK (telefono IS NULL OR length(telefono) <= 40),
  documento      text CHECK (documento IS NULL OR length(documento) <= 15),
  direcciones    jsonb NOT NULL DEFAULT '[]'::jsonb,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tienda_clientes_direcciones_lista
    CHECK (jsonb_typeof(direcciones) = 'array' AND jsonb_array_length(direcciones) <= 5 AND length(direcciones::text) <= 8000)
);

ALTER TABLE public.tienda_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tienda_clientes_propio ON public.tienda_clientes;
CREATE POLICY tienda_clientes_propio ON public.tienda_clientes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS tienda_clientes_panel ON public.tienda_clientes;
CREATE POLICY tienda_clientes_panel ON public.tienda_clientes
  FOR SELECT TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = ANY (ARRAY['admin', 'vendedor']));

-- 8. Pedidos de acceso o borrado de datos (Ley 25.326): los carga el servidor y los ve el admin.
CREATE TABLE IF NOT EXISTS public.pedidos_de_privacidad (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email     text NOT NULL,
  tipo      text NOT NULL CHECK (tipo IN ('copia', 'borrado', 'rectificacion')),
  detalle   text CHECK (detalle IS NULL OR length(detalle) <= 2000),
  estado    text NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido', 'en_proceso', 'cerrado')),
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos_de_privacidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_de_privacidad_panel ON public.pedidos_de_privacidad;
CREATE POLICY pedidos_de_privacidad_panel ON public.pedidos_de_privacidad
  FOR SELECT TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = 'admin');

-- 9. Facturas en PDF: las sube el panel a un bucket privado; el cliente las baja con un enlace firmado.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS factura_path text,
  ADD COLUMN IF NOT EXISTS factura_subida_en timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('facturas', 'facturas', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 10. Cupón personal: nace con el email de la compra y se activa en la cuenta de ese email (client_id).
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS origen_order_id bigint REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email_destino text,
  ADD COLUMN IF NOT EXISTS activado_en timestamptz,
  ADD COLUMN IF NOT EXISTS categorias bigint[];

CREATE UNIQUE INDEX IF NOT EXISTS coupons_origen_order_unico ON public.coupons (origen_order_id) WHERE origen_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coupons_email_destino ON public.coupons (email_destino) WHERE email_destino IS NOT NULL;

-- Un cupón no se usa más veces de las que permite, aunque dos compras lleguen juntas.
CREATE OR REPLACE FUNCTION public.cupon_sin_pasarse()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.max_uses IS NOT NULL
     AND COALESCE(NEW.used_count, 0) > NEW.max_uses
     AND COALESCE(NEW.used_count, 0) > COALESCE(OLD.used_count, 0) THEN
    RAISE EXCEPTION 'El cupón ya se usó.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS cupon_sin_pasarse ON public.coupons;
CREATE TRIGGER cupon_sin_pasarse
  BEFORE UPDATE OF used_count ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.cupon_sin_pasarse();

-- Si la compra que usó el cupón vence o se cancela sin pagar, el cupón vuelve a estar disponible.
CREATE OR REPLACE FUNCTION public.devolver_cupon_del_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.coupon_id IS NOT NULL AND OLD.status = 'pendiente_pago' AND NEW.status IN ('vencido', 'cancelado') THEN
    UPDATE public.coupons SET used_count = GREATEST(COALESCE(used_count, 0) - 1, 0), updated_at = now() WHERE id = NEW.coupon_id;
    DELETE FROM public.coupon_usage WHERE order_id = NEW.id AND coupon_id = NEW.coupon_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS devolver_cupon_del_pedido ON public.orders;
CREATE TRIGGER devolver_cupon_del_pedido
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.devolver_cupon_del_pedido();

-- Configuración del cupón para la próxima compra. Arranca apagado y sin valor: lo define el panel.
INSERT INTO public.tienda_configuracion (clave, valor, descripcion)
VALUES (
  'cupon_segunda_compra',
  '{"activo": false, "tipo": "percentage", "valor": 0, "minimo": 0, "tope": null, "dias": 60, "categorias": [], "solo_primera": true}'::jsonb,
  'Cupón que se genera al entregar una compra: se manda en el email de entrega y se activa en Mi cuenta.'
)
ON CONFLICT (clave) DO NOTHING;

-- Lo llama el servidor al pasar un pedido a entregado. Devuelve el cupón (nuevo o el que ya tenía) o null.
CREATE OR REPLACE FUNCTION public.tienda_emitir_cupon_de_compra(p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_cfg      jsonb;
  v_email    text;
  v_origen   text;
  v_codigo   text;
  v_existe   public.coupons;
  v_alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_valor    numeric;
  v_tipo     text;
  v_dias     int;
BEGIN
  SELECT valor INTO v_cfg FROM public.tienda_configuracion WHERE clave = 'cupon_segunda_compra';
  IF v_cfg IS NULL OR COALESCE((v_cfg->>'activo')::boolean, false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  v_valor := COALESCE(NULLIF(v_cfg->>'valor', '')::numeric, 0);
  v_tipo  := COALESCE(v_cfg->>'tipo', 'percentage');
  IF v_valor <= 0 OR v_tipo NOT IN ('percentage', 'fixed') OR (v_tipo = 'percentage' AND v_valor > 90) THEN
    RETURN NULL;
  END IF;

  SELECT lower(comprador_email), origen INTO v_email, v_origen FROM public.orders WHERE id = p_order_id;
  IF v_email IS NULL OR v_origen IS DISTINCT FROM 'tienda' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_existe FROM public.coupons WHERE origen_order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object('codigo', v_existe.code, 'nuevo', false);
  END IF;

  -- Con "solo la primera compra", cada email recibe un único cupón de este tipo.
  IF COALESCE((v_cfg->>'solo_primera')::boolean, true)
     AND EXISTS (SELECT 1 FROM public.coupons WHERE email_destino = v_email AND origen_order_id IS NOT NULL) THEN
    RETURN NULL;
  END IF;

  LOOP
    SELECT 'TQ-' || string_agg(substr(v_alfabeto, 1 + (get_byte(r.b, i) % length(v_alfabeto)), 1), '' ORDER BY i)
      INTO v_codigo
      FROM (SELECT gen_random_bytes(8) AS b) r, generate_series(0, 7) AS i;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = v_codigo);
  END LOOP;

  v_dias := GREATEST(LEAST(COALESCE(NULLIF(v_cfg->>'dias', '')::int, 60), 365), 1);

  INSERT INTO public.coupons (
    code, discount_type, discount_value, min_purchase, max_discount, max_uses, used_count, expires_at,
    client_id, is_active, origen_order_id, email_destino, categorias
  ) VALUES (
    v_codigo, v_tipo, v_valor,
    NULLIF(COALESCE(NULLIF(v_cfg->>'minimo', '')::numeric, 0), 0),
    NULLIF(v_cfg->>'tope', '')::numeric,
    1, 0, now() + make_interval(days => v_dias),
    NULL, true, p_order_id, v_email,
    NULLIF(ARRAY(SELECT x::bigint FROM jsonb_array_elements_text(COALESCE(v_cfg->'categorias', '[]'::jsonb)) AS x), '{}'::bigint[])
  );

  RETURN jsonb_build_object('codigo', v_codigo, 'nuevo', true);
END;
$function$;

-- Activar un cupón personal en la cuenta: solo con la sesión del email al que se emitió.
CREATE OR REPLACE FUNCTION public.tienda_activar_cupon(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_email text := public.tienda_email_de_la_sesion();
  v       public.coupons;
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Entrá a tu cuenta para activar el cupón.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v FROM public.coupons WHERE code = upper(trim(COALESCE(p_codigo, ''))) FOR UPDATE;
  IF NOT FOUND OR v.email_destino IS NULL THEN
    RAISE EXCEPTION 'No encontramos ese cupón. Revisá el código del email.' USING ERRCODE = 'P0001';
  END IF;
  IF v.email_destino <> v_email THEN
    RAISE EXCEPTION 'Este cupón es de otra cuenta: entrá con el email de la compra para activarlo.' USING ERRCODE = 'P0001';
  END IF;
  IF v.client_id IS NOT NULL THEN
    IF v.client_id = auth.uid() THEN
      RETURN jsonb_build_object('codigo', v.code, 'ya_estaba', true);
    END IF;
    RAISE EXCEPTION 'Este cupón ya está activado en otra cuenta.' USING ERRCODE = 'P0001';
  END IF;
  IF v.expires_at IS NOT NULL AND v.expires_at <= now() THEN
    RAISE EXCEPTION 'El cupón venció.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.coupons SET client_id = auth.uid(), activado_en = now(), updated_at = now() WHERE id = v.id;
  RETURN jsonb_build_object('codigo', v.code, 'ya_estaba', false);
END;
$function$;

-- Los cupones personales de la cuenta: los activados y los que esperan activación con su email.
CREATE OR REPLACE FUNCTION public.tienda_mis_cupones()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'codigo', c.code,
      'tipo', c.discount_type,
      'valor', c.discount_value,
      'minimo', c.min_purchase,
      'tope', c.max_discount,
      'vence_en', c.expires_at,
      'activado', c.client_id IS NOT NULL,
      'usado', c.max_uses IS NOT NULL AND COALESCE(c.used_count, 0) >= c.max_uses,
      'vencido', c.expires_at IS NOT NULL AND c.expires_at <= now(),
      'categorias', COALESCE((SELECT jsonb_agg(cat.name ORDER BY cat.name) FROM public.categories cat WHERE cat.id = ANY (c.categorias)), '[]'::jsonb),
      'compra', (SELECT o.order_number FROM public.orders o WHERE o.id = c.origen_order_id)
    ) ORDER BY c.created_at DESC), '[]'::jsonb)
  FROM public.coupons c
  WHERE auth.uid() IS NOT NULL
    AND c.email_destino IS NOT NULL
    AND (c.client_id = auth.uid() OR (c.client_id IS NULL AND c.email_destino = public.tienda_email_de_la_sesion()));
$function$;

-- Mis compras: las de la tienda hechas con el email confirmado de la sesión, con o sin cuenta.
CREATE OR REPLACE FUNCTION public.tienda_mis_compras()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(jsonb_agg(x.compra ORDER BY x.creado DESC), '[]'::jsonb)
  FROM (
    SELECT o.created_at AS creado, jsonb_build_object(
      'id', o.id,
      'numero', o.order_number,
      'estado', o.status,
      'creado_en', o.created_at,
      'total', o.total,
      'token', o.token_acceso,
      'factura', o.factura_path IS NOT NULL,
      'seguimiento', o.tracking_number,
      'seguimiento_url', o.envio_seguimiento_url,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('nombre', i.name, 'cantidad', i.quantity, 'imagen', p.image) ORDER BY i.id)
        FROM public.order_items i
        LEFT JOIN public.products p ON p.id = i.product_id
        WHERE i.order_id = o.id
      ), '[]'::jsonb)
    ) AS compra
    FROM public.orders o
    WHERE auth.uid() IS NOT NULL
      AND o.origen = 'tienda'
      AND o.token_acceso IS NOT NULL
      AND lower(o.comprador_email) = public.tienda_email_de_la_sesion()
    ORDER BY o.created_at DESC
    LIMIT 50
  ) x;
$function$;

-- La compra pública suma factura, seguimiento, retiro en sucursal y el cupón que generó.
CREATE OR REPLACE FUNCTION public.tienda_pedido(p_id bigint, p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'numero', o.order_number,
    'estado', o.status,
    'creado_en', o.created_at,
    'pagado_en', o.pagado_en,
    'entregado_en', o.entregado_en,
    'total', o.total,
    'subtotal', o.subtotal,
    'envio_costo', o.shipping_cost,
    'envio_demora_dias_min', o.envio_demora_dias_min,
    'envio_demora_dias_max', o.envio_demora_dias_max,
    'descuento', o.discount_amount,
    'medio_pago', o.payment_method,
    'seguimiento', o.tracking_number,
    'seguimiento_url', o.envio_seguimiento_url,
    'transporte', COALESCE(o.shipping_transport, CASE WHEN o.shipping_provider = 'zipnova' THEN NULL ELSE o.shipping_provider END),
    'envio_opcion', COALESCE(o.envio_detalle->>'opcion', 'domicilio'),
    'sucursal', o.envio_detalle->>'sucursal',
    'factura', o.factura_path IS NOT NULL,
    'comprador', jsonb_build_object('nombre', o.comprador_nombre, 'email', o.comprador_email),
    'direccion', o.direccion_envio,
    'cupon', (
      SELECT jsonb_build_object(
        'codigo', c.code,
        'tipo', c.discount_type,
        'valor', c.discount_value,
        'minimo', c.min_purchase,
        'tope', c.max_discount,
        'vence_en', c.expires_at,
        'activado', c.client_id IS NOT NULL
      )
      FROM public.coupons c
      WHERE c.origen_order_id = o.id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'producto_id', i.product_id,
        'nombre', i.name,
        'sku', i.sku,
        'cantidad', i.quantity,
        'precio_final', i.precio_final,
        'slug', p.slug,
        'categoria_slug', c.slug,
        'imagen', p.image
      ) ORDER BY i.id)
      FROM public.order_items i
      LEFT JOIN public.products p ON p.id = i.product_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_id AND o.token_acceso IS NOT NULL AND o.token_acceso = p_token;
$function$;

-- Permisos de las funciones nuevas: las de la cuenta, con sesión; la que emite cupones, solo el servidor.
REVOKE ALL ON FUNCTION public.tienda_email_de_la_sesion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_email_de_la_sesion() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tienda_activar_cupon(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_activar_cupon(text) TO authenticated;

REVOKE ALL ON FUNCTION public.tienda_mis_cupones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_mis_cupones() TO authenticated;

REVOKE ALL ON FUNCTION public.tienda_mis_compras() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_mis_compras() TO authenticated;

REVOKE ALL ON FUNCTION public.tienda_emitir_cupon_de_compra(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_emitir_cupon_de_compra(bigint) TO service_role;
