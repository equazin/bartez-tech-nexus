import { supabase } from "@/lib/supabase";
import { resolveProductImageUrl } from "@/lib/productImage";

/**
 * Catálogo público de la tienda. Lee solo la vista `tienda_productos` y los RPC
 * `tienda_categorias` y `tienda_buscar`, que nunca exponen costo ni margen.
 */

export interface ProductoPublico {
  id: number;
  slug: string;
  nombre: string;
  descripcion_corta: string | null;
  descripcion: string | null;
  imagenes: string[];
  imagen: string | null;
  categoria_nombre: string | null;
  categoria_id: number | null;
  categoria_slug: string | null;
  marca_id: string | null;
  marca: string | null;
  hay_stock: boolean;
  pocas_unidades: boolean;
  sku: string | null;
  iva_rate: number | null;
  precio_final_ars: number | null;
  precio_lista_ars: number | null;
  oferta: boolean;
  tags: string[] | null;
  peso_kg: number | null;
  destacado: boolean;
  specs: Record<string, unknown> | null;
  /** Las etiquetas del producto más las que hereda de su categoría (por ejemplo, gaming). */
  etiquetas: string[];
  creado_en: string | null;
  /** Entró al catálogo hace menos de los días que fija el panel (30 por defecto). */
  nuevo: boolean;
  /** Cuánto baja el precio final contra el de lista, en %, redondeado hacia abajo; nulo sin oferta. */
  ahorro_pct: number | null;
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  cantidad: number;
  /** El nombre para el chip dentro de su categoría madre ("Gamer" dentro de Notebooks). */
  nombre_corto: string;
  orden: number;
  /** Vista transversal: además de su rama, lista los productos con esta etiqueta (Gaming). */
  incluye_etiqueta: string | null;
  hijas: CategoriaPublica[];
}

export interface FilaDeCategoria {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  cantidad: number;
  nombre_corto?: string | null;
  orden?: number | null;
  incluye_etiqueta?: string | null;
}

export type OrdenDelCatalogo = "destacados" | "precio_asc" | "precio_desc" | "nombre" | "nuevos" | "ahorro";

export const ORDENES: Array<{ valor: OrdenDelCatalogo; etiqueta: string }> = [
  { valor: "destacados", etiqueta: "Destacados" },
  { valor: "precio_asc", etiqueta: "Menor precio" },
  { valor: "precio_desc", etiqueta: "Mayor precio" },
  { valor: "nuevos", etiqueta: "Más nuevos" },
  { valor: "nombre", etiqueta: "Nombre" },
];

/** Las ofertas suman el orden por ahorro. */
export const ORDENES_DE_OFERTAS: Array<{ valor: OrdenDelCatalogo; etiqueta: string }> = [
  { valor: "ahorro", etiqueta: "Mayor ahorro" },
  ...ORDENES.filter((o) => o.valor !== "destacados"),
];

export const POR_PAGINA = 24;

const COLUMNAS =
  "id, slug, nombre, descripcion_corta, descripcion, imagenes, imagen, categoria_nombre, categoria_id, " +
  "categoria_slug, marca_id, marca, hay_stock, pocas_unidades, sku, iva_rate, precio_final_ars, " +
  "precio_lista_ars, oferta, tags, peso_kg, destacado, specs, etiquetas, creado_en, nuevo, ahorro_pct";

export const SEGMENTO_SIN_CATEGORIA = "productos";

export function imagenesDe(producto: Pick<ProductoPublico, "imagenes" | "imagen">): string[] {
  const lista = Array.isArray(producto.imagenes) ? producto.imagenes.map(String).filter(Boolean) : [];
  if (lista.length > 0) return lista.map((url) => resolveProductImageUrl(url));
  return producto.imagen ? [resolveProductImageUrl(producto.imagen)] : [];
}

export function imagenPrincipal(producto: Pick<ProductoPublico, "imagenes" | "imagen">): string | null {
  return imagenesDe(producto)[0] ?? null;
}

export function rutaDelProducto(producto: Pick<ProductoPublico, "slug" | "categoria_slug">): string {
  return `/${producto.categoria_slug ?? SEGMENTO_SIN_CATEGORIA}/${producto.slug}`;
}

function conOrden<T extends { order: (columna: string, opciones?: { ascending?: boolean; nullsFirst?: boolean }) => T }>(
  consulta: T,
  orden: OrdenDelCatalogo,
): T {
  switch (orden) {
    case "precio_asc":
      return consulta.order("precio_final_ars", { ascending: true, nullsFirst: false }).order("nombre", { ascending: true });
    case "precio_desc":
      return consulta.order("precio_final_ars", { ascending: false, nullsFirst: false }).order("nombre", { ascending: true });
    case "nombre":
      return consulta.order("nombre", { ascending: true });
    case "nuevos":
      return consulta.order("creado_en", { ascending: false, nullsFirst: false }).order("nombre", { ascending: true });
    case "ahorro":
      return consulta.order("ahorro_pct", { ascending: false, nullsFirst: false }).order("nombre", { ascending: true });
    case "destacados":
    default:
      return consulta.order("destacado", { ascending: false }).order("nombre", { ascending: true });
  }
}

/**
 * Qué productos entran en una categoría:
 *   - una categoría común: los de su rama (ella y sus hijas);
 *   - una vista transversal (Gaming): los de su rama o los que llevan su etiqueta;
 *   - una vista transversal filtrada por una subcategoría (?sub=): los de esa subcategoría que
 *     además llevan la etiqueta (los teclados gamer, no todos los teclados).
 */
export interface FiltroDeCategoria {
  categoriaIds: number[];
  etiqueta: string | null;
  /** true: categoría O etiqueta. false: categoría Y etiqueta. */
  unirConEtiqueta: boolean;
}

export function filtroDeCategoria(nodo: CategoriaPublica, sub: CategoriaPublica | null = null): FiltroDeCategoria {
  const etiqueta = nodo.incluye_etiqueta ? etiquetaSegura(nodo.incluye_etiqueta) : null;
  if (etiqueta && sub) return { categoriaIds: idsConDescendientes(sub), etiqueta, unirConEtiqueta: false };
  return { categoriaIds: idsConDescendientes(nodo), etiqueta, unirConEtiqueta: Boolean(etiqueta) };
}

/** Una etiqueta solo con letras, números y guiones, para armar el filtro de PostgREST sin sorpresas. */
export function etiquetaSegura(etiqueta: string): string | null {
  const limpia = etiqueta.trim().toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(limpia) ? limpia : null;
}

/** Lo mínimo del constructor de consultas de Supabase que usa el filtro de categoría. */
interface ConsultaFiltrable {
  in(columna: string, valores: readonly unknown[]): ConsultaFiltrable;
  contains(columna: string, valor: string[]): ConsultaFiltrable;
  or(filtros: string): ConsultaFiltrable;
}

function conFiltro<T>(consulta: T, filtro: FiltroDeCategoria | undefined): T {
  if (!filtro) return consulta;
  const { categoriaIds, etiqueta, unirConEtiqueta } = filtro;
  let resultado = consulta as unknown as ConsultaFiltrable;
  if (etiqueta && unirConEtiqueta) {
    resultado =
      categoriaIds.length > 0 ? resultado.or(`categoria_id.in.(${categoriaIds.join(",")}),etiquetas.cs.{${etiqueta}}`) : resultado.contains("etiquetas", [etiqueta]);
    return resultado as unknown as T;
  }
  if (categoriaIds.length > 0) resultado = resultado.in("categoria_id", categoriaIds);
  if (etiqueta) resultado = resultado.contains("etiquetas", [etiqueta]);
  return resultado as unknown as T;
}

export interface OpcionesDeListado {
  filtro?: FiltroDeCategoria;
  marcaId?: string | null;
  orden?: OrdenDelCatalogo;
  pagina?: number;
  porPagina?: number;
  /** Solo los que tienen precio de lista tachado (las ofertas). */
  soloOfertas?: boolean;
  /** Solo los que tienen precio final calculado. */
  soloConPrecio?: boolean;
  soloConStock?: boolean;
}

export async function listarProductos(opciones: OpcionesDeListado = {}): Promise<{ productos: ProductoPublico[]; total: number }> {
  const { filtro, marcaId, orden = "destacados", pagina = 0, porPagina = POR_PAGINA, soloOfertas, soloConPrecio, soloConStock } = opciones;
  let consulta = conFiltro(supabase.from("tienda_productos").select(COLUMNAS, { count: "exact" }), filtro);
  if (marcaId) consulta = consulta.eq("marca_id", marcaId);
  if (soloOfertas) consulta = consulta.eq("oferta", true);
  if (soloConPrecio) consulta = consulta.not("precio_final_ars", "is", null);
  if (soloConStock) consulta = consulta.eq("hay_stock", true);
  consulta = conOrden(consulta, orden);
  const desde = pagina * porPagina;
  const { data, error, count } = await consulta.range(desde, desde + porPagina - 1);
  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return { productos: (data ?? []) as unknown as ProductoPublico[], total: count ?? 0 };
}

/** Cuántos productos de una vista transversal hay en cada categoría, para sus chips. */
export async function contarPorCategoria(filtro: FiltroDeCategoria): Promise<Map<number, number>> {
  const { data, error } = await conFiltro(supabase.from("tienda_productos").select("categoria_id").limit(2000), filtro);
  if (error) throw new Error(`No se pudieron contar los productos: ${error.message}`);
  const conteo = new Map<number, number>();
  for (const fila of (data ?? []) as Array<{ categoria_id: number | null }>) {
    if (fila.categoria_id !== null) conteo.set(fila.categoria_id, (conteo.get(fila.categoria_id) ?? 0) + 1);
  }
  return conteo;
}

export async function listarMarcasDeCategoria(filtro?: FiltroDeCategoria): Promise<Array<{ id: string; nombre: string }>> {
  const consulta = conFiltro(supabase.from("tienda_productos").select("marca_id, marca").not("marca_id", "is", null).limit(1000), filtro);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar las marcas: ${error.message}`);
  const vistas = new Map<string, string>();
  for (const fila of (data ?? []) as Array<{ marca_id: string | null; marca: string | null }>) {
    if (fila.marca_id && !vistas.has(fila.marca_id)) vistas.set(fila.marca_id, fila.marca ?? "Sin marca");
  }
  return [...vistas.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function listarProductosPorIds(ids: number[]): Promise<ProductoPublico[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("tienda_productos").select(COLUMNAS).in("id", ids);
  if (error) throw new Error(`No se pudieron cargar los productos del carrito: ${error.message}`);
  return (data ?? []) as unknown as ProductoPublico[];
}

export async function obtenerProducto(slug: string): Promise<ProductoPublico | null> {
  const { data, error } = await supabase.from("tienda_productos").select(COLUMNAS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`No se pudo cargar el producto: ${error.message}`);
  return (data as unknown as ProductoPublico | null) ?? null;
}

export async function listarDestacados(limite = 8): Promise<ProductoPublico[]> {
  const { data, error } = await supabase
    .from("tienda_productos")
    .select(COLUMNAS)
    .eq("destacado", true)
    .eq("hay_stock", true)
    .order("nombre", { ascending: true })
    .limit(limite);
  if (error) throw new Error(`No se pudieron cargar los destacados: ${error.message}`);
  return (data ?? []) as unknown as ProductoPublico[];
}

/** Las ofertas con stock, de mayor a menor ahorro. */
export async function listarOfertas(limite = 8): Promise<ProductoPublico[]> {
  const { productos } = await listarProductos({ soloOfertas: true, soloConStock: true, orden: "ahorro", porPagina: limite });
  return productos;
}

/** Lo último que entró al catálogo, con precio y stock. */
export async function listarNuevosIngresos(limite = 8): Promise<ProductoPublico[]> {
  const { productos } = await listarProductos({ soloConPrecio: true, soloConStock: true, orden: "nuevos", porPagina: limite });
  return productos;
}

export async function buscarProductos(q: string, limite = 48): Promise<ProductoPublico[]> {
  const termino = q.trim();
  if (termino.length < 2) return [];
  const { data, error } = await supabase.rpc("tienda_buscar", { q: termino, limite });
  if (error) throw new Error(`No se pudo buscar: ${error.message}`);
  return (data ?? []) as unknown as ProductoPublico[];
}

export function armarArbol(filas: FilaDeCategoria[]): CategoriaPublica[] {
  const nodos = new Map<number, CategoriaPublica>();
  for (const fila of filas) {
    nodos.set(fila.id, {
      id: fila.id,
      nombre: fila.nombre,
      slug: fila.slug,
      padre_id: fila.padre_id,
      cantidad: fila.cantidad,
      nombre_corto: fila.nombre_corto?.trim() || fila.nombre,
      orden: typeof fila.orden === "number" ? fila.orden : 100,
      incluye_etiqueta: fila.incluye_etiqueta?.trim() || null,
      hijas: [],
    });
  }
  const raices: CategoriaPublica[] = [];
  for (const nodo of nodos.values()) {
    const padre = nodo.padre_id !== null ? nodos.get(nodo.padre_id) : undefined;
    if (padre) padre.hijas = [...padre.hijas, nodo];
    else raices.push(nodo);
  }
  const ordenar = (lista: CategoriaPublica[]): CategoriaPublica[] =>
    [...lista].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")).map((n) => ({ ...n, hijas: ordenar(n.hijas) }));
  return ordenar(raices);
}

let categoriasEnMemoria: Promise<CategoriaPublica[]> | null = null;

export function listarCategorias(): Promise<CategoriaPublica[]> {
  if (!categoriasEnMemoria) {
    categoriasEnMemoria = Promise.resolve(
      supabase.rpc("tienda_categorias").then(({ data, error }) => {
        if (error) {
          categoriasEnMemoria = null;
          throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
        }
        return armarArbol((data ?? []) as FilaDeCategoria[]);
      }),
    );
  }
  return categoriasEnMemoria;
}

export function encontrarCategoria(raices: CategoriaPublica[], slug: string): CategoriaPublica | null {
  for (const nodo of raices) {
    if (nodo.slug === slug) return nodo;
    const encontrada = encontrarCategoria(nodo.hijas, slug);
    if (encontrada) return encontrada;
  }
  return null;
}

export function idsConDescendientes(nodo: CategoriaPublica): number[] {
  return [nodo.id, ...nodo.hijas.flatMap(idsConDescendientes)];
}

/** Todas las categorías del árbol, en el orden del menú (madre antes que hijas). */
export function aplanar(raices: CategoriaPublica[]): CategoriaPublica[] {
  return raices.flatMap((nodo) => [nodo, ...aplanar(nodo.hijas)]);
}

export interface ChipDeCategoria {
  categoria: CategoriaPublica;
  cantidad: number;
  etiqueta: string;
}

/**
 * Los chips de subcategoría de una categoría. En una común, sus hijas con productos y el nombre
 * corto. En una vista transversal, cada categoría donde hay productos de la vista (las propias y
 * las de otras ramas, como Notebooks gamer o Teclados), con el nombre completo y en el orden del
 * menú: las hojas, no sus madres, para que un chip no repita a otro.
 */
export function chipsDeCategoria(raices: CategoriaPublica[], nodo: CategoriaPublica, conteoDeVista?: Map<number, number>): ChipDeCategoria[] {
  if (!nodo.incluye_etiqueta || !conteoDeVista) {
    return nodo.hijas.filter((h) => h.cantidad > 0).map((h) => ({ categoria: h, cantidad: h.cantidad, etiqueta: h.nombre_corto }));
  }
  const chips: ChipDeCategoria[] = [];
  const recorrer = (lista: CategoriaPublica[]) => {
    for (const categoria of lista) {
      const cantidad = conteoDeVista.get(categoria.id) ?? 0;
      if (cantidad > 0 && categoria.id !== nodo.id) chips.push({ categoria, cantidad, etiqueta: categoria.nombre });
      recorrer(categoria.hijas);
    }
  };
  const propias = nodo.hijas;
  recorrer(propias);
  recorrer(raices.filter((r) => r.id !== nodo.id));
  return chips;
}

/** La cadena de categorías desde la raíz hasta la buscada, para las migas de pan. */
export function rutaDeCategoria(raices: CategoriaPublica[], id: number): CategoriaPublica[] {
  for (const nodo of raices) {
    if (nodo.id === id) return [nodo];
    const dentro = rutaDeCategoria(nodo.hijas, id);
    if (dentro.length > 0) return [nodo, ...dentro];
  }
  return [];
}
