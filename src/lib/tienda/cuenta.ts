import { supabase } from "@/lib/supabase";
import { formatearPesos } from "@/lib/tienda/dinero";

/**
 * Mi cuenta: se entra con un código que llega por email (sin contraseña). Las compras se reconocen por el
 * email confirmado de la sesión, así aparecen también las que se hicieron sin cuenta.
 */

export interface DireccionGuardada {
  calle: string;
  numero: string;
  piso?: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
}

export interface MisDatos {
  nombre: string;
  telefono: string;
  documento: string;
  /** La primera es la principal: con ella se completa el checkout. Hasta cinco. */
  direcciones: DireccionGuardada[];
}

export interface CompraDeLaCuenta {
  id: number;
  numero: string;
  estado: string;
  creado_en: string;
  total: number;
  token: string;
  factura: boolean;
  seguimiento: string | null;
  seguimiento_url: string | null;
  items: Array<{ nombre: string; cantidad: number; imagen: string | null }>;
}

export interface CuponDeLaCuenta {
  codigo: string;
  tipo: "percentage" | "fixed";
  valor: number;
  minimo: number | null;
  tope: number | null;
  vence_en: string | null;
  activado: boolean;
  usado: boolean;
  vencido: boolean;
  categorias: string[];
  compra: string | null;
}

export const MAXIMO_DE_DIRECCIONES = 5;

function errorDeIngreso(mensaje: string): string {
  if (/rate|seconds|too many|security purposes/i.test(mensaje)) return "Pediste varios códigos seguidos. Esperá un minuto y probá de nuevo.";
  if (/expired|invalid|token/i.test(mensaje)) return "El código no es válido o venció. Pedí uno nuevo.";
  if (/signups? not allowed|not allowed for otp/i.test(mensaje)) return "Por ahora no se pueden crear cuentas nuevas. Escribinos y lo resolvemos.";
  if (/email/i.test(mensaje) && /invalid|format/i.test(mensaje)) return "Revisá el email.";
  return "No pudimos completar el ingreso. Probá de nuevo en un momento.";
}

/** Manda el código de ingreso. Si el email no tiene cuenta, la crea: no hay registro aparte. */
export async function enviarCodigo(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/cuenta` },
  });
  if (error) throw new Error(errorDeIngreso(error.message));
}

export async function verificarCodigo(email: string, codigo: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: codigo.replace(/\D/g, ""), type: "email" });
  if (error) throw new Error(errorDeIngreso(error.message));
}

export async function tokenDeLaSesion(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function misCompras(): Promise<CompraDeLaCuenta[]> {
  const { data, error } = await supabase.rpc("tienda_mis_compras");
  if (error) throw new Error("No pudimos cargar tus compras. Probá de nuevo en un momento.");
  return (data as CompraDeLaCuenta[] | null) ?? [];
}

export async function misCupones(): Promise<CuponDeLaCuenta[]> {
  const { data, error } = await supabase.rpc("tienda_mis_cupones");
  if (error) throw new Error("No pudimos cargar tus cupones. Probá de nuevo en un momento.");
  return (data as CuponDeLaCuenta[] | null) ?? [];
}

/** Los mensajes de la base ya vienen en castellano ("Este cupón es de otra cuenta..."). */
export async function activarCupon(codigo: string): Promise<{ codigo: string; ya_estaba: boolean }> {
  const { data, error } = await supabase.rpc("tienda_activar_cupon", { p_codigo: codigo.trim().toUpperCase() });
  if (error) throw new Error(error.message || "No se pudo activar el cupón.");
  return data as { codigo: string; ya_estaba: boolean };
}

export const cuponUsable = (c: CuponDeLaCuenta): boolean => c.activado && !c.usado && !c.vencido;

export async function leerMisDatos(): Promise<MisDatos | null> {
  const { data, error } = await supabase.from("tienda_clientes").select("nombre, telefono, documento, direcciones").maybeSingle();
  if (error) throw new Error("No pudimos cargar tus datos.");
  if (!data) return null;
  const fila = data as { nombre: string | null; telefono: string | null; documento: string | null; direcciones: DireccionGuardada[] | null };
  return {
    nombre: fila.nombre ?? "",
    telefono: fila.telefono ?? "",
    documento: fila.documento ?? "",
    direcciones: Array.isArray(fila.direcciones) ? fila.direcciones : [],
  };
}

export async function guardarMisDatos(userId: string, datos: MisDatos): Promise<void> {
  const { error } = await supabase.from("tienda_clientes").upsert(
    {
      user_id: userId,
      nombre: datos.nombre.trim().slice(0, 120) || null,
      telefono: datos.telefono.trim().slice(0, 40) || null,
      documento: datos.documento.replace(/[.\- ]/g, "").slice(0, 15) || null,
      direcciones: datos.direcciones.slice(0, MAXIMO_DE_DIRECCIONES),
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("No pudimos guardar tus datos. Probá de nuevo.");
}

const claveDeDireccion = (d: DireccionGuardada): string =>
  [d.calle, d.numero, d.piso ?? "", d.codigo_postal].map((x) => x.trim().toLowerCase()).join("|");

/** Pone la dirección primera (principal) sin repetirla y respeta el máximo. */
export function conDireccionPrincipal(lista: DireccionGuardada[], nueva: DireccionGuardada): DireccionGuardada[] {
  const clave = claveDeDireccion(nueva);
  return [nueva, ...lista.filter((d) => claveDeDireccion(d) !== clave)].slice(0, MAXIMO_DE_DIRECCIONES);
}

export const textoDeDireccion = (d: DireccionGuardada): string =>
  `${d.calle} ${d.numero}${d.piso ? `, ${d.piso}` : ""} · ${d.localidad}, ${d.provincia} (CP ${d.codigo_postal})`;

export async function pedirPorMisDatos(tipo: "copia" | "borrado" | "rectificacion", detalle?: string): Promise<void> {
  const token = await tokenDeLaSesion();
  if (!token) throw new Error("Entrá a tu cuenta para hacer el pedido.");
  const respuesta = await fetch("/api/cuenta?recurso=privacidad", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tipo, detalle: detalle?.trim() || undefined }),
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!respuesta.ok || json.ok === false) throw new Error(json.error ?? "No se pudo mandar el pedido.");
}

export const enlaceDeFactura = (id: number, token: string): string => `/api/cuenta?recurso=factura&id=${id}&t=${encodeURIComponent(token)}`;

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" });

/** "10% de descuento en compras desde $ 100.000, hasta $ 20.000". Igual que el email de entrega. */
export function describirCupon(c: Pick<CuponDeLaCuenta, "tipo" | "valor" | "minimo" | "tope">): string {
  const descuento = c.tipo === "fixed" ? `${formatearPesos(Number(c.valor))} de descuento` : `${Number(c.valor)}% de descuento`;
  const desde = c.minimo && c.minimo > 0 ? ` en compras desde ${formatearPesos(Number(c.minimo))}` : "";
  const hasta = c.tipo !== "fixed" && c.tope && c.tope > 0 ? `, hasta ${formatearPesos(Number(c.tope))}` : "";
  return `${descuento}${desde}${hasta}`;
}

export const fechaDeVencimiento = (iso: string | null): string | null => (iso ? formatoFecha.format(new Date(iso)) : null);
