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
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  cantidad: number;
  hijas: CategoriaPublica[];
}

interface FilaDeCategoria {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  cantidad: number;
}

export type OrdenDelCatalogo = "destacados" | "precio_asc" | "precio_desc" | "nombre";

export const ORDENES: Array<{ valor: OrdenDelCatalogo; etiqueta: string }> = [
  { valor: "destacados", etiqueta: "Destacados" },
  { valor: "precio_asc", etiqueta: "Menor precio" },
  { valor: "precio_desc", etiqueta: "Mayor precio" },
  { valor: "nombre", etiqueta: "Nombre" },
];

export const POR_PAGINA = 24;

const COLUMNAS =
  "id, slug, nombre, descripcion_corta, descripcion, imagenes, imagen, categoria_nombre, categoria_id, " +
  "categoria_slug, marca_id, marca, hay_stock, pocas_unidades, sku, iva_rate, precio_final_ars, " +
  "precio_lista_ars, oferta, tags, peso_kg, destacado, specs";

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
    case "destacados":
    default:
      return consulta.order("destacado", { ascending: false }).order("nombre", { ascending: true });
  }
}

export interface OpcionesDeListado {
  categoriaIds?: number[];
  marcaId?: string | null;
  orden?: OrdenDelCatalogo;
  pagina?: number;
  porPagina?: number;
}

export async function listarProductos(opciones: OpcionesDeListado = {}): Promise<{ productos: ProductoPublico[]; total: number }> {
  const { categoriaIds, marcaId, orden = "destacados", pagina = 0, porPagina = POR_PAGINA } = opciones;
  let consulta = supabase.from("tienda_productos").select(COLUMNAS, { count: "exact" });
  if (categoriaIds && categoriaIds.length > 0) consulta = consulta.in("categoria_id", categoriaIds);
  if (marcaId) consulta = consulta.eq("marca_id", marcaId);
  consulta = conOrden(consulta, orden);
  const desde = pagina * porPagina;
  const { data, error, count } = await consulta.range(desde, desde + porPagina - 1);
  if (error) throw new Error(`No se pudo cargar el catálogo: ${error.message}`);
  return { productos: (data ?? []) as unknown as ProductoPublico[], total: count ?? 0 };
}

export async function listarMarcasDeCategoria(categoriaIds: number[]): Promise<Array<{ id: string; nombre: string }>> {
  let consulta = supabase.from("tienda_productos").select("marca_id, marca").not("marca_id", "is", null).limit(1000);
  if (categoriaIds.length > 0) consulta = consulta.in("categoria_id", categoriaIds);
  const { data, error } = await consulta;
  if (error) throw new Error(`No se pudieron cargar las marcas: ${error.message}`);
  const vistas = new Map<string, string>();
  for (const fila of (data ?? []) as Array<{ marca_id: string | null; marca: string | null }>) {
    if (fila.marca_id && !vistas.has(fila.marca_id)) vistas.set(fila.marca_id, fila.marca ?? "Sin marca");
  }
  return [...vistas.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
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

export async function buscarProductos(q: string, limite = 48): Promise<ProductoPublico[]> {
  const termino = q.trim();
  if (termino.length < 2) return [];
  const { data, error } = await supabase.rpc("tienda_buscar", { q: termino, limite });
  if (error) throw new Error(`No se pudo buscar: ${error.message}`);
  return (data ?? []) as unknown as ProductoPublico[];
}

function armarArbol(filas: FilaDeCategoria[]): CategoriaPublica[] {
  const nodos = new Map<number, CategoriaPublica>();
  for (const fila of filas) {
    nodos.set(fila.id, { ...fila, hijas: [] });
  }
  const raices: CategoriaPublica[] = [];
  for (const nodo of nodos.values()) {
    const padre = nodo.padre_id !== null ? nodos.get(nodo.padre_id) : undefined;
    if (padre) padre.hijas = [...padre.hijas, nodo];
    else raices.push(nodo);
  }
  const ordenar = (lista: CategoriaPublica[]): CategoriaPublica[] =>
    [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((n) => ({ ...n, hijas: ordenar(n.hijas) }));
  return ordenar(raices);
}

let categoriasEnMemoria: Promise<CategoriaPublica[]> | null = null;

export function listarCategorias(): Promise<CategoriaPublica[]> {
  if (!categoriasEnMemoria) {
    categoriasEnMemoria = supabase
      .rpc("tienda_categorias")
      .then(({ data, error }) => {
        if (error) {
          categoriasEnMemoria = null;
          throw new Error(`No se pudieron cargar las categorías: ${error.message}`);
        }
        return armarArbol((data ?? []) as FilaDeCategoria[]);
      });
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

/** La cadena de categorías desde la raíz hasta la buscada, para las migas de pan. */
export function rutaDeCategoria(raices: CategoriaPublica[], id: number): CategoriaPublica[] {
  for (const nodo of raices) {
    if (nodo.id === id) return [nodo];
    const dentro = rutaDeCategoria(nodo.hijas, id);
    if (dentro.length > 0) return [nodo, ...dentro];
  }
  return [];
}
