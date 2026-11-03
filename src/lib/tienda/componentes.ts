import { encontrarCategoria, idsConDescendientes, listarCategorias, listarProductos, type ProductoPublico } from "./catalogo";
import { PASOS, pasoDeCategoria, type Armado, type IdDePaso, type Seleccion } from "./armador";

/** Los componentes de PC de la tienda, para el armador y para las PC armadas del panel. */
export async function listarComponentes(): Promise<ProductoPublico[]> {
  const raices = await listarCategorias();
  const nodo = encontrarCategoria(raices, "pc-y-componentes");
  if (!nodo) return [];
  const { productos } = await listarProductos({ categoriaIds: idsConDescendientes(nodo), porPagina: 1000 });
  return productos;
}

export function agruparPorPaso(productos: ProductoPublico[]): Record<IdDePaso, ProductoPublico[]> {
  const grupos = Object.fromEntries(PASOS.map((p) => [p.id, [] as ProductoPublico[]])) as Record<IdDePaso, ProductoPublico[]>;
  for (const p of productos) {
    const paso = pasoDeCategoria(p.categoria_slug);
    if (paso) grupos[paso].push(p);
  }
  return grupos;
}

/** Las piezas de un armado con su producto, para evaluar la compatibilidad. */
export function seleccionDe(piezas: Armado["piezas"], porId: Map<number, ProductoPublico>): Seleccion {
  const seleccion: Seleccion = {};
  for (const paso of PASOS) {
    const pieza = piezas[paso.id];
    const producto = pieza ? porId.get(pieza.id) : undefined;
    if (producto) seleccion[paso.id] = producto;
  }
  return seleccion;
}
