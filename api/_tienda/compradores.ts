import { getSupabaseAdmin } from "../_shared/supabaseServer.js";

/**
 * Los compradores de la tienda para el panel (pantalla Compradores). La tienda no exige cuenta: un comprador es cada
 * email distinto de las compras. Se arma con las últimas compras, sus productos, los mails que salieron y el saldo de
 * puntos. Solo datos de la venta: acá no viajan costos ni márgenes.
 */

const ESTADOS_PAGOS = new Set(["pagado", "preparando", "enviado", "entregado"]);
/** Lo que la base devuelve en una sola consulta. Con más compras que estas, la lista avisa que no están todas. */
const MAXIMO_DE_COMPRAS = 1000;
/** Las consultas por compra van de a tandas: así la lista de ids entra en la dirección del pedido. */
const COMPRAS_POR_TANDA = 150;
const MAILS_POR_COMPRADOR = 12;
/** Tope de saldos de puntos que se calculan por pedido de la lista. */
const MAXIMO_DE_SALDOS = 200;

interface Direccion {
  calle?: string | null;
  numero?: string | null;
  piso?: string | null;
  localidad?: string | null;
  provincia?: string | null;
  codigo_postal?: string | null;
  opcion?: string | null;
}

interface FilaDeCompra {
  id: number;
  order_number: string;
  status: string;
  payment_method: string | null;
  total: number;
  shipping_cost: number | null;
  created_at: string;
  client_id: string | null;
  comprador_email: string | null;
  comprador_nombre: string | null;
  comprador_telefono: string | null;
  comprador_documento: string | null;
  direccion_envio: Direccion | null;
  envio_detalle: { opcion?: string | null; sucursal?: string | null; costo?: number | null } | null;
}

export interface CompraDelComprador {
  id: number;
  numero: string;
  fecha: string;
  estado: string;
  medio: string | null;
  total: number;
  /** Nulo: la compra no guardó el costo del envío. */
  envio_costo: number | null;
  productos: string[];
}

export interface MailDelComprador {
  tipo: string;
  numero: string;
  /** Cuándo se empezó a mandar. */
  anotado_en: string;
  /** Cuándo lo aceptó el servidor de correo. Nulo: no quedó confirmado. */
  confirmado_en: string | null;
}

export interface PuntosDelComprador {
  disponibles: number;
  pendientes: number;
  proxima_liberacion: string | null;
}

export interface UltimoEnvio {
  opcion: string | null;
  sucursal: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
}

export interface CompradorDelPanel {
  email: string;
  nombre: string | null;
  telefono: string | null;
  documento: string | null;
  con_cuenta: boolean;
  ultimo_envio: UltimoEnvio | null;
  compras: CompraDelComprador[];
  compras_pagas: number;
  total_pagado: number;
  primera_compra: string;
  esperando_pago: boolean;
  con_reintegro: boolean;
  puntos: PuntosDelComprador | null;
  mails: MailDelComprador[];
}

export interface ListaDeCompradores {
  compradores: CompradorDelPanel[];
  /** Hay más compras que las leídas: los totales de los compradores más viejos pueden quedar cortos. */
  hay_mas_compras: boolean;
}

const enTandas = <T>(lista: T[], tamano: number): T[][] => Array.from({ length: Math.ceil(lista.length / tamano) }, (_, i) => lista.slice(i * tamano, (i + 1) * tamano));

const limpio = (valor: string | null | undefined): string | null => (typeof valor === "string" && valor.trim() ? valor.trim() : null);

function envioDe(compra: FilaDeCompra): UltimoEnvio | null {
  const d = compra.direccion_envio;
  if (!d) return null;
  return {
    opcion: limpio(compra.envio_detalle?.opcion) ?? limpio(d.opcion),
    sucursal: limpio(compra.envio_detalle?.sucursal),
    calle: limpio(d.calle),
    numero: limpio(d.numero),
    piso: limpio(d.piso),
    localidad: limpio(d.localidad),
    provincia: limpio(d.provincia),
    codigo_postal: limpio(d.codigo_postal),
  };
}

function costoDelEnvio(compra: FilaDeCompra): number | null {
  const costo = compra.shipping_cost ?? compra.envio_detalle?.costo ?? null;
  return costo === null || !Number.isFinite(Number(costo)) ? null : Number(costo);
}

/** Lee de a tandas una tabla que cuelga de las compras y devuelve todas las filas juntas. */
async function leerPorCompra<T>(tabla: string, columnas: string, ids: number[]): Promise<T[]> {
  const supabase = getSupabaseAdmin();
  const tandas = await Promise.all(
    enTandas(ids, COMPRAS_POR_TANDA).map(async (tanda) => {
      const { data, error } = await supabase.from(tabla).select(columnas).in("order_id", tanda);
      if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
      return (data ?? []) as unknown as T[];
    }),
  );
  return tandas.flat();
}

/** El saldo de puntos de cada email que tiene movimientos. Si no se puede leer, la lista sale sin puntos. */
async function saldosDePuntos(emails: string[]): Promise<Map<string, PuntosDelComprador>> {
  const saldos = new Map<string, PuntosDelComprador>();
  if (emails.length === 0) return saldos;
  const supabase = getSupabaseAdmin();
  const conMovimientos = new Set<string>();
  for (const tanda of enTandas(emails, COMPRAS_POR_TANDA)) {
    const { data, error } = await supabase.from("puntos_movimientos").select("email").in("email", tanda);
    if (error) {
      console.error("[compradores] No se pudieron leer los puntos:", error.message);
      return saldos;
    }
    for (const fila of (data ?? []) as Array<{ email: string }>) conMovimientos.add(fila.email);
  }
  await Promise.all(
    [...conMovimientos].slice(0, MAXIMO_DE_SALDOS).map(async (email) => {
      const { data, error } = await supabase.rpc("puntos_saldo_de", { p_email: email });
      if (error || !data) return;
      const saldo = data as { disponibles?: number; pendientes?: number; proxima_liberacion?: string | null };
      saldos.set(email, { disponibles: Number(saldo.disponibles ?? 0), pendientes: Number(saldo.pendientes ?? 0), proxima_liberacion: saldo.proxima_liberacion ?? null });
    }),
  );
  return saldos;
}

export async function listarCompradores(): Promise<ListaDeCompradores> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_method, total, shipping_cost, created_at, client_id, comprador_email, comprador_nombre, comprador_telefono, comprador_documento, direccion_envio, envio_detalle")
    .eq("origen", "tienda")
    .order("created_at", { ascending: false })
    .limit(MAXIMO_DE_COMPRAS);
  if (error) throw new Error(`No se pudieron leer las compras: ${error.message}`);
  const compras = ((data ?? []) as FilaDeCompra[]).filter((c) => limpio(c.comprador_email));
  const ids = compras.map((c) => c.id);
  const emailDe = (c: FilaDeCompra) => (c.comprador_email ?? "").trim().toLowerCase();
  const emails = [...new Set(compras.map(emailDe))];

  const [lineas, avisos, reintegros, saldos] = await Promise.all([
    leerPorCompra<{ order_id: number; name: string; quantity: number }>("order_items", "order_id, name, quantity", ids),
    leerPorCompra<{ order_id: number; tipo: string; enviado_en: string; confirmado_en: string | null }>("avisos_al_comprador", "order_id, tipo, enviado_en, confirmado_en", ids),
    supabase.from("pagos").select("order_id").gt("reintegrado_monto", 0),
    saldosDePuntos(emails),
  ]);
  if (reintegros.error) throw new Error(`No se pudieron leer los reintegros: ${reintegros.error.message}`);

  const productosPorCompra = new Map<number, string[]>();
  for (const linea of lineas) {
    const texto = linea.quantity > 1 ? `${linea.name} × ${linea.quantity}` : linea.name;
    productosPorCompra.set(linea.order_id, [...(productosPorCompra.get(linea.order_id) ?? []), texto]);
  }
  const avisosPorCompra = new Map<number, typeof avisos>();
  for (const aviso of avisos) avisosPorCompra.set(aviso.order_id, [...(avisosPorCompra.get(aviso.order_id) ?? []), aviso]);
  const conPagoReintegrado = new Set(((reintegros.data ?? []) as Array<{ order_id: number }>).map((r) => r.order_id));

  // Las compras vienen de la más nueva a la más vieja: la primera de cada email es la última que hizo.
  const porEmail = new Map<string, FilaDeCompra[]>();
  for (const compra of compras) porEmail.set(emailDe(compra), [...(porEmail.get(emailDe(compra)) ?? []), compra]);

  const compradores = [...porEmail.entries()].map(([email, suyas]): CompradorDelPanel => {
    const pagas = suyas.filter((c) => ESTADOS_PAGOS.has(c.status));
    const conDireccion = suyas.find((c) => c.direccion_envio);
    const mails = suyas
      .flatMap((c) => (avisosPorCompra.get(c.id) ?? []).map((a) => ({ tipo: a.tipo, numero: c.order_number, anotado_en: a.enviado_en, confirmado_en: a.confirmado_en })))
      .sort((a, b) => b.anotado_en.localeCompare(a.anotado_en))
      .slice(0, MAILS_POR_COMPRADOR);
    return {
      email,
      nombre: suyas.map((c) => limpio(c.comprador_nombre)).find(Boolean) ?? null,
      telefono: suyas.map((c) => limpio(c.comprador_telefono)).find(Boolean) ?? null,
      documento: suyas.map((c) => limpio(c.comprador_documento)).find(Boolean) ?? null,
      con_cuenta: suyas.some((c) => c.client_id !== null),
      ultimo_envio: conDireccion ? envioDe(conDireccion) : null,
      compras: suyas.map((c) => ({
        id: c.id,
        numero: c.order_number,
        fecha: c.created_at,
        estado: c.status,
        medio: c.payment_method,
        total: Number(c.total),
        envio_costo: costoDelEnvio(c),
        productos: productosPorCompra.get(c.id) ?? [],
      })),
      compras_pagas: pagas.length,
      total_pagado: pagas.reduce((suma, c) => suma + Number(c.total), 0),
      primera_compra: suyas[suyas.length - 1].created_at,
      esperando_pago: suyas.some((c) => c.status === "pendiente_pago"),
      con_reintegro: suyas.some((c) => c.status === "reintegrado" || conPagoReintegrado.has(c.id)),
      puntos: saldos.get(email) ?? null,
      mails,
    };
  });

  return { compradores, hay_mas_compras: (data ?? []).length >= MAXIMO_DE_COMPRAS };
}
