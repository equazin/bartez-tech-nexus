import type { VercelRequest, VercelResponse } from "@vercel/node";

import { sitioPublico } from "../_shared/avisos.js";
import { getSupabaseAdmin } from "../_shared/supabaseServer.js";

/**
 * GET /api/tienda?modulo=pagina&categoria=<slug>[&producto=<slug>]
 *
 * Qué responder en una dirección de categoría o de producto que no tiene página propia en el despliegue: un
 * producto publicado después del último despliegue, el producto de prueba, o una dirección que no existe.
 * vercel.json manda acá solo esas direcciones: las páginas prerenderizadas y las pantallas de la aplicación
 * (carrito, checkout, mi cuenta, el panel) se sirven antes, sin pasar por una función.
 *
 * Devuelve siempre la base de la aplicación, que es la que dibuja la página: con 200 si la categoría o el
 * producto existen y con 404 si no, para que los buscadores dejen de tomar las direcciones inexistentes como
 * páginas. Si la base de datos no responde, sale con 200: un problema nuestro no convierte páginas reales en 404.
 */

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const MINUTOS_DE_LA_BASE_EN_MEMORIA = 5;

let baseEnMemoria: { html: string; hasta: number } | null = null;

/** La base de la aplicación (aplicacion.html del despliegue), que se pide al propio sitio y queda unos minutos en memoria. */
async function baseDeLaAplicacion(): Promise<string | null> {
  if (baseEnMemoria && baseEnMemoria.hasta > Date.now()) return baseEnMemoria.html;
  const sitio = sitioPublico();
  if (!sitio) return null;
  try {
    const respuesta = await fetch(`${sitio}/aplicacion`, { headers: { Accept: "text/html" } });
    if (!respuesta.ok) return null;
    const html = await respuesta.text();
    if (!html.includes('id="root"')) return null;
    baseEnMemoria = { html, hasta: Date.now() + MINUTOS_DE_LA_BASE_EN_MEMORIA * 60_000 };
    return html;
  } catch (e: unknown) {
    console.error("[pagina] no se pudo leer la base de la aplicación:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Si la dirección corresponde a algo publicado: un producto (por su slug) o una categoría de la tienda. */
async function existe(categoria: string, producto: string | null): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (producto) {
    const { data, error } = await supabase.from("tienda_productos").select("id").eq("slug", producto).limit(1);
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  }
  const { data, error } = await supabase.rpc("tienda_categorias");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ slug?: string | null }>).some((c) => c.slug === categoria);
}

const unSolo = (valor: unknown): string => (typeof valor === "string" ? valor : Array.isArray(valor) && typeof valor[0] === "string" ? valor[0] : "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).end();
    return;
  }
  const categoria = unSolo(req.query.categoria);
  const producto = unSolo(req.query.producto) || null;

  let encontrada = false;
  if (SLUG.test(categoria) && (producto === null || SLUG.test(producto))) {
    try {
      encontrada = await existe(categoria, producto);
    } catch (e: unknown) {
      console.error("[pagina]", categoria, producto ?? "", e instanceof Error ? e.message : e);
      encontrada = true;
    }
  }

  const html = await baseDeLaAplicacion();
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!html) {
    // Sin la base no hay aplicación que dibujar: una página mínima con el código que corresponde.
    res.setHeader("Cache-Control", "no-store");
    res
      .status(encontrada ? 503 : 404)
      .send('<!doctype html><html lang="es"><head><meta charset="UTF-8" /><meta name="robots" content="noindex" /><title>Teqo</title></head><body><p>No pudimos cargar la página.</p><a href="/">Ir al inicio</a></body></html>');
    return;
  }
  if (encontrada) {
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(html);
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
  res.setHeader("X-Robots-Tag", "noindex");
  res.status(404).send(html);
}
