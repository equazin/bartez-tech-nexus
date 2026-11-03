import { supabase } from "@/lib/supabase";
import { PASOS, type Armado } from "./armador";

/**
 * Las PC armadas que se cargan en el panel (Armá tu PC › PC armadas). La vista pública trae solo las
 * publicadas con todas las piezas en la tienda, con precio y con stock; el precio es la suma de las piezas.
 */

export interface PcArmadaPublica {
  id: string;
  nombre: string;
  texto: string;
  piezas: Armado["piezas"];
}

export function piezasValidas(crudo: unknown): Armado["piezas"] {
  const piezas: Armado["piezas"] = {};
  if (!crudo || typeof crudo !== "object") return piezas;
  const origen = crudo as Record<string, { id?: unknown; cantidad?: unknown }>;
  for (const paso of PASOS) {
    const pieza = origen[paso.id];
    if (pieza && typeof pieza.id === "number") piezas[paso.id] = { id: pieza.id, cantidad: Math.max(1, Math.min(8, Math.floor(Number(pieza.cantidad ?? 1)) || 1)) };
  }
  return piezas;
}

export async function listarPcArmadas(): Promise<PcArmadaPublica[]> {
  const { data, error } = await supabase.from("tienda_pc_armadas").select("id, nombre, texto, piezas").order("orden");
  if (error) throw new Error(`No se pudieron cargar las PC armadas: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; nombre: string; texto: string | null; piezas: unknown }>).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    texto: a.texto ?? "",
    piezas: piezasValidas(a.piezas),
  }));
}
