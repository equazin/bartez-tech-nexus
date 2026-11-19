import { createHash } from "node:crypto";

import { waitUntil } from "@vercel/functions";

import { getSupabaseAdmin } from "./supabaseServer.js";

/**
 * Las páginas de la tienda (el inicio, las categorías y las fichas) se escriben en cada despliegue con el precio y
 * el stock de ese momento: es lo que lee quien no ejecuta la aplicación, como el rastreador con el que Google
 * compara la ficha con el feed. El feed, en cambio, sale de la base en el momento. Si cambian los precios o el stock
 * y no se vuelve a desplegar, las páginas quedan declarando el precio viejo mientras el feed ya declara el nuevo.
 *
 * VERCEL_DEPLOY_HOOK_URL es el gancho de despliegue de la rama de producción. Sin él no se pide nada.
 */

const FILAS_POR_PEDIDO = 1000;

/** Pide un despliegue. Devuelve si el gancho lo aceptó. */
export async function pedirDespliegue(motivo: string): Promise<boolean> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim();
  if (!hook) {
    console.warn(`[despliegue] Falta VERCEL_DEPLOY_HOOK_URL: no se pidió el despliegue (${motivo}).`);
    return false;
  }
  try {
    const respuesta = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo }) });
    if (!respuesta.ok) {
      console.error(`[despliegue] El gancho respondió ${respuesta.status} (${motivo}).`);
      return false;
    }
    console.log(`[despliegue] Pedido (${motivo}).`);
    return true;
  } catch (e: unknown) {
    console.error(`[despliegue] No se pudo pedir (${motivo}):`, e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Lo pide sin demorar la respuesta. Con `waitUntil` la función sigue viva hasta que el gancho contesta: una promesa
 * suelta se corta cuando la función responde, y el pedido no llegaba a salir.
 */
export function pedirDespliegueDespues(motivo: string): void {
  waitUntil(pedirDespliegue(motivo));
}

/**
 * Un resumen corto de lo que las páginas escritas declaran de cada producto publicado: el precio y si hay stock.
 * Si cambia de una vez a la otra, alguna página quedó vieja, venga el cambio de donde venga (el dólar, un costo,
 * el stock del mayorista, una venta o una edición en el panel). Null si no se pudo leer el catálogo.
 */
export async function huellaDelCatalogo(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const partes: string[] = [];
  for (let desde = 0; ; desde += FILAS_POR_PEDIDO) {
    const { data, error } = await supabase
      .from("tienda_productos")
      .select("id, precio_final_ars, hay_stock")
      .order("id", { ascending: true })
      .range(desde, desde + FILAS_POR_PEDIDO - 1);
    if (error) {
      console.error("[despliegue] No se pudo leer el catálogo para comparar:", error.message);
      return null;
    }
    const filas = (data ?? []) as Array<{ id: number; precio_final_ars: number | string | null; hay_stock: boolean | null }>;
    for (const fila of filas) partes.push(`${fila.id}:${fila.precio_final_ars ?? ""}:${fila.hay_stock ? 1 : 0}`);
    if (filas.length < FILAS_POR_PEDIDO) break;
  }
  return createHash("sha256").update(partes.join(",")).digest("hex");
}
