import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Puntos Teqo. Las reglas y el saldo los calcula la base (tienda_programa_de_puntos, tienda_mis_puntos y
 * tienda_canjear_puntos); acá solo se leen y se muestran. Los puntos se suman al entregar una compra, sobre lo
 * pagado en productos sin el envío, y se canjean por un cupón personal ya activado en la cuenta.
 */

export interface EventoDePuntos {
  nombre: string;
  multiplicador: number;
  hasta: string;
  categorias: number[];
}

export interface ProgramaDePuntos {
  activo: boolean;
  pesos_por_punto: number;
  valor_del_punto: number;
  minimo_para_canjear: number;
  tope_porcentaje: number;
  dias_de_espera: number;
  meses_de_vencimiento: number;
  eventos: EventoDePuntos[];
}

export interface SaldoDePuntos {
  disponibles: number;
  pendientes: number;
  por_vencer: number;
  proximo_vencimiento: string | null;
  proxima_liberacion: string | null;
}

export type TipoDeMovimiento = "compra" | "bono" | "canje" | "devolucion" | "reverso" | "vencimiento" | "ajuste";

export interface MovimientoDePuntos {
  id: number;
  tipo: TipoDeMovimiento;
  puntos: number;
  detalle: string | null;
  fecha: string;
  disponible_desde: string;
  vence_en: string | null;
  compra: string | null;
  cupon: string | null;
}

export interface MisPuntos {
  programa: ProgramaDePuntos;
  saldo: SaldoDePuntos;
  movimientos: MovimientoDePuntos[];
}

export interface CuponDeCanje {
  codigo: string;
  valor: number;
  minimo: number;
  vence_en: string;
  puntos: number;
}

const mensajeDe = (e: { message?: string } | null, porDefecto: string) => (e?.message && !/^[A-Z0-9]{5}$/.test(e.message) ? e.message : porDefecto);

let programaEnMemoria: Promise<ProgramaDePuntos | null> | null = null;

/** Las reglas públicas del programa, una vez por visita. Sin respuesta, como si estuviera apagado. */
export function leerProgramaDePuntos(): Promise<ProgramaDePuntos | null> {
  programaEnMemoria ??= (async () => {
    const { data, error } = await supabase.rpc("tienda_programa_de_puntos");
    if (error || !data) return null;
    return data as ProgramaDePuntos;
  })().catch(() => null);
  return programaEnMemoria;
}

export function useProgramaDePuntos(): ProgramaDePuntos | null {
  const [programa, setPrograma] = useState<ProgramaDePuntos | null>(null);
  useEffect(() => {
    let cancelado = false;
    void leerProgramaDePuntos().then((p) => {
      if (!cancelado) setPrograma(p);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return programa;
}

/** Los puntos que suma un monto pagado en productos (sin el envío). */
export function puntosPorMonto(monto: number, programa: ProgramaDePuntos | null): number {
  if (!programa?.activo || !(monto > 0) || !(programa.pesos_por_punto > 0)) return 0;
  return Math.floor(monto / programa.pesos_por_punto);
}

export const formatearPuntos = (n: number) => new Intl.NumberFormat("es-AR").format(n);

export async function misPuntos(): Promise<MisPuntos> {
  // Los bonos por crear la cuenta o completar los datos se acreditan al mirar los puntos (una sola vez cada uno).
  await supabase.rpc("tienda_reclamar_bonos");
  const { data, error } = await supabase.rpc("tienda_mis_puntos");
  if (error) throw new Error(mensajeDe(error, "No pudimos cargar tus puntos."));
  return data as MisPuntos;
}

export async function canjearPuntos(puntos: number): Promise<CuponDeCanje> {
  const { data, error } = await supabase.rpc("tienda_canjear_puntos", { p_puntos: Math.floor(puntos) });
  if (error) throw new Error(mensajeDe(error, "No pudimos hacer el canje. Probá de nuevo en un momento."));
  programaEnMemoria = null;
  return data as CuponDeCanje;
}
