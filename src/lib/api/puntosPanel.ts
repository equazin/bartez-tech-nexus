import { supabase } from "@/lib/supabase";
import type { MovimientoDePuntos, SaldoDePuntos } from "@/lib/tienda/puntos";

/** Panel › Marketing › Puntos: reglas, eventos, consulta por email y ajustes. Todo pasa por la base con la sesión. */

export interface ReglasDePuntos {
  activo: boolean;
  pesos_por_punto: number;
  valor_del_punto: number;
  dias_de_espera: number;
  meses_de_vencimiento: number;
  minimo_para_canjear: number;
  tope_porcentaje: number;
  dias_del_cupon: number;
  bono_cuenta: number;
  bono_datos: number;
  bono_primera_compra: number;
}

export interface ResumenDePuntos {
  clientes: number;
  emitidos: number;
  anulados: number;
  canjeados: number;
  vencidos: number;
  ajustes: number;
  saldo: number;
  saldo_en_pesos: number;
}

export interface EventoDelPanel {
  id: string;
  nombre: string;
  multiplicador: number;
  desde: string;
  hasta: string;
  categorias: number[] | null;
  activo: boolean;
}

export interface PuntosDeCliente {
  email: string;
  saldo: SaldoDePuntos;
  movimientos: MovimientoDePuntos[];
}

export interface CategoriaDelPanel {
  id: number;
  name: string;
  parent_id: number | null;
}

const mensaje = (e: { message?: string } | null, porDefecto: string) => e?.message || porDefecto;

export async function leerPanelDePuntos(): Promise<{ reglas: ReglasDePuntos | null; resumen: ResumenDePuntos }> {
  const { data, error } = await supabase.rpc("tienda_puntos_panel");
  if (error) throw new Error(mensaje(error, "No se pudo leer el programa de puntos."));
  const datos = data as { configuracion: ReglasDePuntos | null; resumen: ResumenDePuntos };
  return { reglas: datos.configuracion, resumen: datos.resumen };
}

export async function guardarReglasDePuntos(reglas: ReglasDePuntos): Promise<ReglasDePuntos> {
  const { data, error } = await supabase.rpc("tienda_puntos_guardar_configuracion", { p_valor: reglas });
  if (error) throw new Error(mensaje(error, "No se pudieron guardar las reglas."));
  return data as ReglasDePuntos;
}

export async function listarEventosDePuntos(): Promise<EventoDelPanel[]> {
  const { data, error } = await supabase.from("puntos_eventos").select("id, nombre, multiplicador, desde, hasta, categorias, activo").order("desde", { ascending: false });
  if (error) throw new Error(mensaje(error, "No se pudieron leer los eventos."));
  return (data ?? []).map((e) => ({ ...(e as EventoDelPanel), multiplicador: Number((e as EventoDelPanel).multiplicador) }));
}

export async function crearEventoDePuntos(evento: Omit<EventoDelPanel, "id">): Promise<void> {
  const { error } = await supabase.from("puntos_eventos").insert({ ...evento, categorias: evento.categorias && evento.categorias.length > 0 ? evento.categorias : null });
  if (error) throw new Error(mensaje(error, "No se pudo crear el evento."));
}

export async function cambiarEventoDePuntos(id: string, cambios: Partial<Omit<EventoDelPanel, "id">>): Promise<void> {
  const { error } = await supabase.from("puntos_eventos").update({ ...cambios, actualizado_en: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(mensaje(error, "No se pudo cambiar el evento."));
}

export async function borrarEventoDePuntos(id: string): Promise<void> {
  const { error } = await supabase.from("puntos_eventos").delete().eq("id", id);
  if (error) throw new Error(mensaje(error, "No se pudo borrar el evento."));
}

export async function puntosDeCliente(email: string): Promise<PuntosDeCliente> {
  const { data, error } = await supabase.rpc("tienda_puntos_de_cliente", { p_email: email.trim().toLowerCase() });
  if (error) throw new Error(mensaje(error, "No se pudieron leer los puntos de ese email."));
  return data as PuntosDeCliente;
}

export async function ajustarPuntos(email: string, puntos: number, motivo: string): Promise<PuntosDeCliente> {
  const { data, error } = await supabase.rpc("tienda_ajustar_puntos", { p_email: email.trim().toLowerCase(), p_puntos: Math.trunc(puntos), p_motivo: motivo });
  if (error) throw new Error(mensaje(error, "No se pudo cargar el ajuste."));
  return data as PuntosDeCliente;
}

export async function listarCategoriasDelPanel(): Promise<CategoriaDelPanel[]> {
  const { data, error } = await supabase.from("categories").select("id, name, parent_id").order("name");
  if (error) throw new Error(mensaje(error, "No se pudieron leer las categorías."));
  return (data ?? []) as CategoriaDelPanel[];
}
