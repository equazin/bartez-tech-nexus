import { supabase } from "@/lib/supabase";

/**
 * Portada del inicio, cargada en el panel (Marketing › Portada del inicio). La vista pública trae las
 * activas y dentro de sus fechas, en orden; la tienda muestra la primera.
 */

export type TipoDePortada = "banner" | "pc";
/** Gris, grafito y rojo: texto a la izquierda y la imagen a la derecha. Los "imagen-*": una portada diseñada de fondo con el texto encima. */
export type FondoDePortada = "gris" | "grafito" | "rojo" | "imagen-oscura" | "imagen-clara" | "imagen-roja";

export interface PortadaPublica {
  id: string;
  tipo: TipoDePortada;
  etiqueta: string;
  titulo: string;
  texto: string;
  boton: string;
  enlace: string;
  imagen_url: string | null;
  fondo: FondoDePortada;
  pc_armada_id: string | null;
}

export const FONDOS_DE_PORTADA: Array<{ id: FondoDePortada; nombre: string }> = [
  { id: "gris", nombre: "Gris" },
  { id: "grafito", nombre: "Grafito" },
  { id: "rojo", nombre: "Rojo" },
  { id: "imagen-oscura", nombre: "Imagen de fondo, texto blanco" },
  { id: "imagen-clara", nombre: "Imagen de fondo, texto oscuro" },
  { id: "imagen-roja", nombre: "Imagen roja, texto blanco" },
];

export const esFondoDeImagen = (fondo: FondoDePortada): boolean => fondo.startsWith("imagen-");

/** Las imágenes subidas van al espacio "portadas"; las demás son fotos de productos (con fondo de placa). */
export function esImagenSubida(url: string | null): boolean {
  return Boolean(url && url.includes("/storage/v1/object/public/portadas/"));
}

export async function listarPortadasVigentes(): Promise<PortadaPublica[]> {
  const { data, error } = await supabase
    .from("tienda_portadas")
    .select("id, tipo, etiqueta, titulo, texto, boton, enlace, imagen_url, fondo, pc_armada_id")
    .order("orden");
  if (error) throw new Error(`No se pudo cargar la portada: ${error.message}`);
  return (data ?? []) as PortadaPublica[];
}
