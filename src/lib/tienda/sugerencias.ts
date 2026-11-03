import { encontrarCategoria, idsConDescendientes, listarCategorias, listarProductos, type ProductoPublico } from "./catalogo";
import { tipoDeProducto } from "./ficha";

/** Qué categorías completan cada tipo de producto: "Completá el setup" en la ficha y el carrito. */
const COMPLEMENTOS: Record<string, string[]> = {
  monitor: ["teclados", "mouse", "auriculares", "soportes-de-monitor"],
  notebook: ["mouse", "auriculares", "mochilas-y-fundas", "hubs-y-adaptadores"],
  periferico: ["mousepads", "auriculares", "mouse", "teclados", "streaming"],
  placa: ["fuentes", "gabinetes", "coolers-y-refrigeracion", "monitores-para-jugar"],
  procesador: ["motherboards", "memorias-ram", "coolers-y-refrigeracion", "discos-internos"],
  memoria: ["discos-internos", "procesadores", "motherboards"],
  disco: ["memorias-ram", "ssd-externos-y-pendrives", "procesadores"],
  fuente: ["placas-de-video", "gabinetes", "estabilizadores-y-ups"],
  gabinete: ["fuentes", "coolers-y-refrigeracion", "motherboards"],
  motherboard: ["procesadores", "memorias-ram", "discos-internos"],
  cooler: ["procesadores", "gabinetes", "fuentes"],
  red: ["estabilizadores-y-ups", "hubs-y-adaptadores"],
  otro: ["mouse", "auriculares"],
};

/** Productos que van bien con estos: se reparten entre las categorías complementarias, sin repetir ni sumar los mismos. */
export async function complementosDe(base: Array<Pick<ProductoPublico, "id" | "categoria_slug">>, cantidad = 4): Promise<ProductoPublico[]> {
  if (base.length === 0) return [];
  const raices = await listarCategorias();
  const excluir = new Set(base.map((p) => p.id));
  const propias = new Set(base.map((p) => p.categoria_slug));
  const slugs: string[] = [];
  for (const p of base) {
    for (const slug of COMPLEMENTOS[tipoDeProducto(p.categoria_slug)] ?? []) {
      if (!slugs.includes(slug) && !propias.has(slug)) slugs.push(slug);
    }
  }
  const grupos = await Promise.all(
    slugs.slice(0, 6).map(async (slug) => {
      const nodo = encontrarCategoria(raices, slug);
      if (!nodo || nodo.cantidad === 0) return [] as ProductoPublico[];
      const { productos } = await listarProductos({ categoriaIds: idsConDescendientes(nodo), orden: "destacados", porPagina: 4, soloConStock: true });
      return productos.filter((p) => !excluir.has(p.id) && p.precio_final_ars !== null);
    }),
  );
  const salida: ProductoPublico[] = [];
  for (let i = 0; salida.length < cantidad && grupos.some((g) => g.length > i); i++) {
    for (const grupo of grupos) {
      if (grupo[i] && salida.length < cantidad) salida.push(grupo[i]);
    }
  }
  return salida;
}

/** Los de la misma categoría con el precio más cercano: "También podés mirar". */
export async function parecidosA(producto: ProductoPublico, cantidad = 5): Promise<ProductoPublico[]> {
  if (producto.categoria_id === null) return [];
  const { productos } = await listarProductos({ categoriaIds: [producto.categoria_id], porPagina: 60, soloConStock: true });
  const precio = producto.precio_final_ars ?? 0;
  return productos
    .filter((p) => p.id !== producto.id)
    .sort((a, b) => Math.abs((a.precio_final_ars ?? 0) - precio) - Math.abs((b.precio_final_ars ?? 0) - precio))
    .slice(0, cantidad);
}
