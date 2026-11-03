-- =============================================================================
-- Teqo · Fase 9 · Legal: arrepentimiento, textos y datos del vendedor
-- El botón de arrepentimiento no pide cuenta: deja un pedido con un código al
-- instante (Res. 424/2020). Los textos legales y los datos del vendedor viven en
-- tienda_configuracion; sin cargar, la tienda muestra los marcadores.
-- =============================================================================

CREATE TABLE IF NOT EXISTS arrepentimientos (
  id             bigserial PRIMARY KEY,
  codigo         text NOT NULL UNIQUE,
  order_id       bigint REFERENCES orders(id) ON DELETE SET NULL,
  numero_pedido  text,
  email          text NOT NULL,
  nombre         text,
  motivo         text,
  estado         text NOT NULL DEFAULT 'recibido' CHECK (estado IN ('recibido', 'en_proceso', 'cerrado', 'rechazado')),
  nota_interna   text,
  respondido_en  timestamptz,
  respondido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arrepentimientos_estado ON arrepentimientos(estado, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_arrepentimientos_email ON arrepentimientos(lower(email));

ALTER TABLE arrepentimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arrepentimientos_panel ON arrepentimientos;
CREATE POLICY arrepentimientos_panel ON arrepentimientos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) IN ('admin', 'vendedor', 'sales')));

INSERT INTO tienda_configuracion (clave, valor, descripcion) VALUES
  ('datos_legales', '{"razon_social": null, "cuit": null, "domicilio": null, "email": null, "telefono": null, "data_fiscal_url": null}'::jsonb,
   'Datos del vendedor que van en el pie: razón social, CUIT, domicilio, contacto y el enlace del Data Fiscal de ARCA.'),
  ('texto_terminos',   'null'::jsonb, 'Términos y condiciones. Los redacta un profesional; sin cargar, la página muestra el marcador.'),
  ('texto_privacidad', 'null'::jsonb, 'Política de privacidad.'),
  ('texto_garantias',  'null'::jsonb, 'Garantías y cambios: plazo y responsable (mínimo legal 6 meses en productos nuevos).')
ON CONFLICT (clave) DO NOTHING;

-- ── Crear un arrepentimiento (la función de la API lo llama con la clave de servicio) ──
CREATE OR REPLACE FUNCTION tienda_crear_arrepentimiento(p_email text, p_numero text, p_motivo text, p_nombre text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_codigo text;
  v_order_id bigint;
  v_numero text;
  v_id bigint;
BEGIN
  LOOP
    v_codigo := 'ARR-' || upper(encode(gen_random_bytes(3), 'hex'));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM arrepentimientos WHERE codigo = v_codigo);
  END LOOP;

  SELECT o.id, o.order_number INTO v_order_id, v_numero
  FROM orders o
  WHERE lower(o.comprador_email) = lower(trim(p_email))
    AND (p_numero IS NULL OR trim(p_numero) = '' OR upper(o.order_number) = upper(trim(p_numero)))
  ORDER BY o.created_at DESC
  LIMIT 1;

  INSERT INTO arrepentimientos (codigo, order_id, numero_pedido, email, nombre, motivo)
  VALUES (v_codigo, v_order_id, coalesce(v_numero, nullif(trim(p_numero), '')), lower(trim(p_email)), nullif(trim(p_nombre), ''), nullif(trim(p_motivo), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'codigo', v_codigo, 'pedido_id', v_order_id, 'numero', coalesce(v_numero, nullif(trim(p_numero), '')));
END;
$$;

REVOKE ALL ON FUNCTION tienda_crear_arrepentimiento(text, text, text, text) FROM public, anon, authenticated;

-- ── Lo que la tienda muestra en el pie y en las páginas legales ─────────────
CREATE OR REPLACE FUNCTION tienda_contenido_legal()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(jsonb_object_agg(clave, valor), '{}'::jsonb)
  FROM tienda_configuracion
  WHERE clave IN ('datos_legales', 'texto_terminos', 'texto_privacidad', 'texto_garantias');
$$;

GRANT EXECUTE ON FUNCTION tienda_contenido_legal() TO anon, authenticated;
