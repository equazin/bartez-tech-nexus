import type { VercelRequest, VercelResponse } from "@vercel/node";

import { sitioPublico } from "../_shared/avisos.js";
import { codificarDireccionDeImagen } from "../_shared/direccionDeImagen.js";
import { fail, methodNotAllowed } from "../_shared/http.js";
import { getSupabaseAdmin } from "../_shared/supabaseServer.js";
import { ETIQUETA_DE_ENVIO_GRATIS } from "./envios.js";

/**
 * Feed de productos para Google Merchant Center (RSS 2.0 con el espacio de nombres g:). El catálogo de Meta lee
 * el mismo formato, así que la dirección sirve para los dos.
 *   GET /feed-google.xml   público
 *
 * Se arma en el momento con la vista pública tienda_productos: el precio y el stock son los que muestra la ficha.
 * El precio es el de transferencia, el mismo que la ficha le declara a Google en sus datos estructurados
 * (src/lib/tienda/seo.ts y scripts/prerender.mjs). Si uno cambia tiene que cambiar el otro: Google rechaza el
 * producto cuando el feed y la página no coinciden. El id es el SKU, igual al de los eventos de medición
 * (src/lib/tienda/medicion.ts), para que la publicidad reconozca el producto.
 * No sale nada que no sea público: ni costo, ni margen, ni proveedor.
 * Una función de Vercel responde hasta 4,5 MB: con unos 1,2 KB por producto alcanza para más de 3.000. Pasado
 * eso hay que partir el feed.
 */

export const config = { maxDuration: 30 };

const NOMBRE = "Teqo";
const MONEDA = "ARS";
const PAIS = "AR";
const ETIQUETA_DE_PRUEBA = "prueba";
const SEGMENTO_SIN_CATEGORIA = "productos";
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const POR_PAGINA = 1000;
const MAXIMO_DE_PRODUCTOS = 20_000;
/** Topes de Merchant Center. */
const LARGO_DEL_ID = 50;
const LARGO_DEL_TITULO = 150;
const LARGO_DE_LA_DESCRIPCION = 5000;
const LARGO_DEL_MPN = 70;
const FOTOS_ADICIONALES = 10;
/** Google lee el feed una vez por día; media hora en la red de Vercel alcanza para no recalcularlo en cada pedido. */
const CACHE = "public, s-maxage=1800, stale-while-revalidate=86400";

interface ProductoDelFeed {
  id: number;
  slug: string | null;
  nombre: string | null;
  descripcion: string | null;
  descripcion_corta: string | null;
  imagenes: unknown;
  imagen: string | null;
  categoria_id: number | null;
  categoria_slug: string | null;
  marca: string | null;
  hay_stock: boolean | null;
  precio_final_ars: number | string | null;
  precio_lista_ars: number | string | null;
  oferta: boolean | null;
  sku: string | null;
  tags: string[] | null;
  peso_kg: number | string | null;
}

interface CategoriaDelFeed {
  id: number;
  nombre: string;
  padre_id: number | null;
}

interface DatosDelFeed {
  sitio: string;
  categorias: Map<number, CategoriaDelFeed>;
  eanPorProducto: Map<number, string>;
  envioGratisDesde: number | null;
}

/** Texto seguro dentro de una etiqueta XML: sin caracteres de control (XML 1.0 no los admite) y con las entidades. */
function escapar(texto: string): string {
  return texto
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const etiqueta = (nombre: string, valor: string): string => `      <g:${nombre}>${escapar(valor)}</g:${nombre}>`;

function recortar(texto: string, largo: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= largo ? limpio : `${limpio.slice(0, largo - 1).trimEnd()}…`;
}

const importe = (monto: number): string => `${monto.toFixed(2)} ${MONEDA}`;

/** Las fotos del producto como direcciones completas. Las del almacenamiento propio van por su ruta pública. */
function fotosDe(p: ProductoDelFeed, sitio: string): string[] {
  const lista = Array.isArray(p.imagenes) ? p.imagenes.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const todas = lista.length > 0 ? lista : p.imagen ? [p.imagen] : [];
  const completas = todas
    .map((url) => url.trim().replace("/storage/v1/object/products/", "/storage/v1/object/public/products/"))
    .map((url) => (url.startsWith("//") ? `https:${url}` : url.startsWith("/") ? `${sitio}${url}` : url))
    .filter((url) => /^https?:\/\//i.test(url))
    // Un «?» o un «%» suelto en el nombre del archivo rompe la dirección y Google rechaza el producto.
    .map(codificarDireccionDeImagen);
  return [...new Set(completas)];
}

/** Un código de barras vale si son 8, 12, 13 o 14 dígitos y cierra el dígito verificador: uno inválido hace rechazar el producto. */
export function gtinValido(crudo: string | null | undefined): string | null {
  const digitos = (crudo ?? "").replace(/[\s-]/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digitos)) return null;
  const cuerpo = digitos.slice(0, -1);
  let suma = 0;
  for (let i = 0; i < cuerpo.length; i += 1) {
    // Desde la derecha, las posiciones impares pesan 3.
    const peso = (cuerpo.length - i) % 2 === 1 ? 3 : 1;
    suma += Number(cuerpo[i]) * peso;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(digitos.slice(-1)) ? digitos : null;
}

/** "Notebooks > Notebooks para estudiar y trabajar": de la raíz a la categoría del producto. */
function rubroDe(categoriaId: number | null, categorias: Map<number, CategoriaDelFeed>): string {
  const cadena: string[] = [];
  const vistas = new Set<number>();
  for (let actual = categoriaId === null ? undefined : categorias.get(categoriaId); actual && !vistas.has(actual.id); actual = actual.padre_id === null ? undefined : categorias.get(actual.padre_id)) {
    vistas.add(actual.id);
    cadena.unshift(actual.nombre);
  }
  return cadena.join(" > ");
}

/** El producto como un <item>, o nulo si le falta algo que Google exige (foto, precio, dirección). */
function itemDe(p: ProductoDelFeed, datos: DatosDelFeed): string | null {
  const slug = p.slug ?? "";
  const segmento = p.categoria_slug ?? SEGMENTO_SIN_CATEGORIA;
  const nombre = (p.nombre ?? "").trim();
  const precio = Number(p.precio_final_ars);
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const fotos = fotosDe(p, datos.sitio);
  if (!SLUG.test(slug) || !SLUG.test(segmento) || !nombre || !Number.isFinite(precio) || precio <= 0 || fotos.length === 0) return null;
  if (tags.includes(ETIQUETA_DE_PRUEBA)) return null;

  const sku = (p.sku ?? "").trim();
  const id = sku && sku.length <= LARGO_DEL_ID ? sku : String(p.id);
  const lista = Number(p.precio_lista_ars);
  const enOferta = p.oferta === true && Number.isFinite(lista) && lista > precio;
  const descripcion = (p.descripcion ?? "").trim() || (p.descripcion_corta ?? "").trim() || `${nombre} con envío a todo el país y precio final con IVA incluido.`;
  const rubro = rubroDe(p.categoria_id === null ? null : Number(p.categoria_id), datos.categorias);
  const gtin = gtinValido(datos.eanPorProducto.get(Number(p.id)));
  const peso = Number(p.peso_kg);
  const envioGratis = (datos.envioGratisDesde !== null && precio >= datos.envioGratisDesde) || tags.includes(ETIQUETA_DE_ENVIO_GRATIS);

  const lineas = [
    etiqueta("id", id),
    etiqueta("title", recortar(nombre, LARGO_DEL_TITULO)),
    etiqueta("description", recortar(descripcion, LARGO_DE_LA_DESCRIPCION)),
    etiqueta("link", `${datos.sitio}/${segmento}/${slug}`),
    etiqueta("image_link", fotos[0]),
    ...fotos.slice(1, 1 + FOTOS_ADICIONALES).map((foto) => etiqueta("additional_image_link", foto)),
    etiqueta("availability", p.hay_stock ? "in_stock" : "out_of_stock"),
    etiqueta("price", importe(enOferta ? lista : precio)),
    ...(enOferta ? [etiqueta("sale_price", importe(precio))] : []),
    etiqueta("condition", "new"),
    ...(p.marca?.trim() ? [etiqueta("brand", p.marca.trim())] : []),
    ...(gtin ? [etiqueta("gtin", gtin)] : []),
    ...(sku && sku.length <= LARGO_DEL_MPN ? [etiqueta("mpn", sku)] : []),
    ...(rubro ? [etiqueta("product_type", rubro)] : []),
    ...(Number.isFinite(peso) && peso > 0 ? [etiqueta("shipping_weight", `${Number(peso.toFixed(3))} kg`)] : []),
    // Solo se declara el envío cuando es gratis: el resto depende del destino y se configura en Merchant Center.
    ...(envioGratis ? [`      <g:shipping>\n        <g:country>${PAIS}</g:country>\n        <g:price>${importe(0)}</g:price>\n      </g:shipping>`] : []),
  ];
  return `    <item>\n${lineas.join("\n")}\n    </item>`;
}

async function leerProductos(): Promise<ProductoDelFeed[]> {
  const supabase = getSupabaseAdmin();
  const productos: ProductoDelFeed[] = [];
  for (let desde = 0; desde < MAXIMO_DE_PRODUCTOS; desde += POR_PAGINA) {
    const { data, error } = await supabase
      .from("tienda_productos")
      .select("id, slug, nombre, descripcion, descripcion_corta, imagenes, imagen, categoria_id, categoria_slug, marca, hay_stock, precio_final_ars, precio_lista_ars, oferta, sku, tags, peso_kg")
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw new Error(`No se pudieron leer los productos: ${error.message}`);
    productos.push(...((data ?? []) as ProductoDelFeed[]));
    if (!data || data.length < POR_PAGINA) break;
  }
  return productos;
}

/** El código de barras no está en la vista pública (va entre los datos del proveedor); de la tabla sale solo eso. */
async function leerCodigosDeBarras(): Promise<Map<number, string>> {
  const supabase = getSupabaseAdmin();
  const codigos = new Map<number, string>();
  for (let desde = 0; desde < MAXIMO_DE_PRODUCTOS; desde += POR_PAGINA) {
    const { data, error } = await supabase
      .from("products")
      .select("id, ean:specs->>ean")
      .eq("active", true)
      .eq("publicado", true)
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);
    if (error) throw new Error(`No se pudieron leer los códigos de barras: ${error.message}`);
    for (const fila of (data ?? []) as Array<{ id: number; ean: string | null }>) {
      if (fila.ean) codigos.set(Number(fila.id), String(fila.ean));
    }
    if (!data || data.length < POR_PAGINA) break;
  }
  return codigos;
}

async function leerCategorias(): Promise<Map<number, CategoriaDelFeed>> {
  const { data, error } = await getSupabaseAdmin().rpc("tienda_categorias");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  const categorias = new Map<number, CategoriaDelFeed>();
  for (const c of (data ?? []) as Array<{ id: number; nombre: string | null; padre_id: number | null }>) {
    if (!c.nombre) continue;
    categorias.set(Number(c.id), { id: Number(c.id), nombre: c.nombre, padre_id: c.padre_id === null || c.padre_id === undefined ? null : Number(c.padre_id) });
  }
  return categorias;
}

async function leerEnvioGratisDesde(): Promise<number | null> {
  const { data, error } = await getSupabaseAdmin().from("tienda_configuracion").select("valor").eq("clave", "envio_gratis_desde").maybeSingle();
  if (error) throw new Error(`No se pudo leer la configuración del envío: ${error.message}`);
  const valor = Number((data as { valor: unknown } | null)?.valor);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

async function armarFeed(sitio: string): Promise<{ xml: string; cantidad: number }> {
  const [productos, categorias, eanPorProducto, envioGratisDesde] = await Promise.all([leerProductos(), leerCategorias(), leerCodigosDeBarras(), leerEnvioGratisDesde()]);
  const datos: DatosDelFeed = { sitio, categorias, eanPorProducto, envioGratisDesde };
  const items = productos.map((p) => itemDe(p, datos)).filter((item): item is string => item !== null);
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
    `  <channel>\n` +
    `    <title>${escapar(NOMBRE)}</title>\n` +
    `    <link>${escapar(sitio)}</link>\n` +
    `    <description>${escapar("Catálogo de Teqo: precios finales con IVA incluido y envío a todo el país.")}</description>\n` +
    `${items.join("\n")}\n` +
    `  </channel>\n` +
    `</rss>\n`;
  return { xml, cantidad: items.length };
}

function sitioDe(req: VercelRequest): string {
  const configurado = sitioPublico();
  if (configurado) return configurado;
  const anfitrion = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
  return anfitrion ? `https://${anfitrion}` : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") return methodNotAllowed(res, ["GET"]);
  try {
    const sitio = sitioDe(req);
    if (!sitio) return fail(res, "Falta la dirección pública del sitio.", 500);
    const { xml, cantidad } = await armarFeed(sitio);
    console.info("[feed]", `${cantidad} productos`);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", CACHE);
    return res.status(200).send(req.method === "HEAD" ? "" : xml);
  } catch (e: unknown) {
    console.error("[feed]", e instanceof Error ? e.message : e);
    return fail(res, "No se pudo armar el feed de productos.", 500);
  }
}
