import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PrecioPorMedio } from "./catalogo";
import { pasoDeCategoria, type IdDePaso } from "./armador";

/**
 * Servicios de la tienda (armado, sistema y drivers, otros), cargados desde el panel en Armá tu PC › Servicios.
 * La vista pública trae solo los activos con precio para cada medio de pago activo.
 */

export interface ServicioPublico {
  id: string;
  nombre: string;
  texto: string;
  /** true: se ofrece solo con una PC completa en el carrito. */
  solo_con_pc: boolean;
  precio_final_ars: number | null;
  precios_por_medio: PrecioPorMedio[] | null;
}

/** Las piezas que tiene que tener el carrito para ofrecer el armado. El checkout del servidor usa la misma lista. */
export const PASOS_DE_UNA_PC: IdDePaso[] = ["procesador", "motherboard", "memoria", "almacenamiento", "gabinete"];

export function esPcCompleta(categorias: Array<string | null | undefined>): boolean {
  const pasos = new Set(categorias.map((c) => pasoDeCategoria(c ?? null)).filter((p): p is IdDePaso => p !== null));
  return PASOS_DE_UNA_PC.every((p) => pasos.has(p));
}

export function servicioDisponible(servicio: ServicioPublico, pcCompleta: boolean): boolean {
  return !servicio.solo_con_pc || pcCompleta;
}

let pedido: Promise<ServicioPublico[]> | null = null;

async function consultar(): Promise<ServicioPublico[]> {
  const { data, error } = await supabase
    .from("tienda_servicios")
    .select("id, nombre, texto, solo_con_pc, precio_final_ars, precios_por_medio")
    .order("orden");
  if (error) throw new Error(`No se pudieron cargar los servicios: ${error.message}`);
  return ((data ?? []) as ServicioPublico[]).map((s) => ({
    ...s,
    precio_final_ars: s.precio_final_ars === null ? null : Number(s.precio_final_ars),
  }));
}

export function listarServicios(): Promise<ServicioPublico[]> {
  if (!pedido) {
    pedido = consultar();
    pedido.catch(() => {
      pedido = null;
    });
  }
  return pedido;
}

export function useServicios(): ServicioPublico[] {
  const [servicios, setServicios] = useState<ServicioPublico[]>([]);
  useEffect(() => {
    let cancelado = false;
    listarServicios()
      .then((lista) => {
        if (!cancelado) setServicios(lista);
      })
      .catch(() => {
        if (!cancelado) setServicios([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);
  return servicios;
}
