import { supabase } from "@/lib/supabase";
import { resolveProductImageUrl } from "@/lib/productImage";

/**
 * Catálogo público de la tienda. Lee solo la vista `tienda_productos` y los RPC
 * `tienda_categorias` y `tienda_buscar`, que nunca exponen costo ni margen.
 */

/** El precio final del producto pagando con un medio, con el margen de ese medio ya aplicado. */
export interface PrecioPorMedio {
  id: string;
  nombre: string;
  precio: number | null;
}

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
  /** Ficha técnica cargada en el panel o por CSV, en orden. Si está vacía se usan las specs. */
  ficha: Array<{ clave: string; valor: string }> | null;
  /**
   * El precio con cada medio activo, del más barato al más caro. precio_final_ars y
   * precio_lista_ars ya son los del medio más barato (transferencia).
   */
  precios_por_medio: PrecioPorMedio[] | null;
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  cantidad: number;
  orden: number;
  descripcion: string | null;
  hijas: CategoriaPublica[];
}

interface FilaDeCategoria {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
  cantidad: number;
  orden: number;
  descripcion: string | null;
}

export type OrdenDelCatalogo = "destacados" | "precio_asc" | "precio_desc" | "nombre" | "nuevos";

export const ORDENES: Array<{ valor: OrdenDelCatalogo; etiqueta: string }> = [
  { valor: "destacados", etiqueta: "Destacados" },
  { valor: "precio_asc", etiqueta: "Menor precio" },
  { valor: "precio_desc", etiqueta: "Mayor precio" },
  { valor: "nuevos", etiqueta: "Nuevos ingresos" },
  { valor: "nombre", etiqueta: "Nombre" },
];

export const POR_PAGINA = 24;

const COLUMNAS =
  "id, slug, nombre, descripcion_corta, descripcion, imagenes, imagen, categoria_nombre, categoria_id, " +
  "categoria_slug, marca_id, marca, hay_stock, pocas_unidades, sku, iva_rate, precio_final_ars, " +
  "precio_lista_ars, oferta, tags, peso_kg, destacado, specs, ficha, precios_por_medio";

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
      return consulta.order("id", { ascending: false });
    case "destacados":
    default:
      return consulta.order("destacado", { ascending: false }).order("nombre", { ascending: true });
  }
}

export interface OpcionesDeListado {
  categoriaIds?: number[];
  marcaId?: string | null;
  soloOfertas?: boolean;
  soloConStock?: boolean;
  orden?: OrdenDelCatalogo;
  pagina?: number;
  porPagina?: number;
}

export async function listarProductos(opciones: OpcionesDeListado = {}): Promise<{ productos: ProductoPublico[]; total: number }> {
  const { categoriaIds, marcaId, soloOfertas, soloConStock, orden = "destacados", pagina = 0, porPagina = POR_PAGINA } = opciones;
  let consulta = supabase.from("tienda_productos").select(COLUMNAS, { count: "exact" });
  if (categoriaIds && categoriaIds.length > 0) consulta = consulta.in("categoria_id", categoriaIds);
  if (marcaId) consulta = consulta.eq("marca_id", marcaId);
  if (soloOfertas) consulta = consulta.eq("oferta", true);
  if (soloConStock) consulta = consulta.eq("hay_stock", true);
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

/** El precio más bajo de un grupo de categorías, para los accesos "desde $ X" de la portada. */
export async function precioDesde(categoriaIds: number[]): Promise<number | null> {
  if (categoriaIds.length === 0) return null;
  const { data, error } = await supabase
    .from("tienda_productos")
    .select("precio_final_ars")
    .in("categoria_id", categoriaIds)
    .not("precio_final_ars", "is", null)
    .order("precio_final_ars", { ascending: true })
    .limit(1);
  if (error) return null;
  const fila = (data ?? [])[0] as { precio_final_ars: number | null } | undefined;
  return fila?.precio_final_ars ?? null;
}

let fotosEnMemoria: Promise<Map<number, string>> | null = null;

/** Una foto por categoría (la del primer destacado o del primero que tenga), para los accesos con imagen. */
export function fotosPorCategoria(): Promise<Map<number, string>> {
  if (!fotosEnMemoria) {
    fotosEnMemoria = Promise.resolve(
      supabase
        .from("tienda_productos")
        .select("categoria_id, imagen, imagenes")
        .not("categoria_id", "is", null)
        .order("destacado", { ascending: false })
        .order("hay_stock", { ascending: false })
        .limit(1000),
    ).then(({ data, error }) => {
      if (error) {
        fotosEnMemoria = null;
        return new Map<number, string>();
      }
      const fotos = new Map<number, string>();
      for (const fila of (data ?? []) as Array<{ categoria_id: number | null; imagen: string | null; imagenes: string[] }>) {
        if (fila.categoria_id === null || fotos.has(fila.categoria_id)) continue;
        const foto = imagenPrincipal(fila);
        if (foto) fotos.set(fila.categoria_id, foto);
      }
      return fotos;
    });
  }
  return fotosEnMemoria;
}

/** La foto de una categoría o, si no tiene productos propios, la de su primera hija con foto. */
export function fotoDeCategoria(nodo: CategoriaPublica, fotos: Map<number, string>): string | null {
  const propia = fotos.get(nodo.id);
  if (propia) return propia;
  for (const hija of nodo.hijas) {
    const foto = fotoDeCategoria(hija, fotos);
    if (foto) return foto;
  }
  return null;
}

/** Todas las categorías en una lista plana, con la raíz de cada una. */
export function categoriasPlanas(raices: CategoriaPublica[]): Array<CategoriaPublica & { raiz: CategoriaPublica }> {
  const salida: Array<CategoriaPublica & { raiz: CategoriaPublica }> = [];
  const recorrer = (nodo: CategoriaPublica, raiz: CategoriaPublica) => {
    salida.push({ ...nodo, raiz });
    nodo.hijas.forEach((hija) => recorrer(hija, raiz));
  };
  raices.forEach((raiz) => recorrer(raiz, raiz));
  return salida;
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
    [...lista].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")).map((n) => ({ ...n, hijas: ordenar(n.hijas) }));
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
