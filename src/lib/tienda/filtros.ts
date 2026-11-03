import type { OrdenDelCatalogo, ProductoPublico } from "./catalogo";
import { paresDeFicha, valorCorto, valorDe } from "./ficha";

/**
 * Filtros de los listados, calculados en el navegador sobre los productos de la categoría:
 * marca, precio, stock y las claves de la ficha que sirven para elegir (pulgadas, Hz, panel...).
 * La selección vive en la URL para poder compartir un listado filtrado.
 */

export interface OpcionDeFiltro {
  valor: string;
  cantidad: number;
}

export interface Faceta {
  clave: string;
  opciones: OpcionDeFiltro[];
}

export interface SeleccionDeFiltros {
  marcas: string[];
  facetas: Record<string, string[]>;
  min: number | null;
  max: number | null;
  soloStock: boolean;
}

/** Las claves de la ficha que pueden ser filtro, en el orden en que se muestran. */
const CLAVES_FILTRABLES = [
  "Pantalla",
  "Resolución",
  "Frecuencia",
  "Panel",
  "Procesador",
  "Memoria",
  "Almacenamiento",
  "Placa de video",
  "Socket",
  "Núcleos",
  "Memoria de video",
  "Capacidad",
  "Tipo",
  "Formato",
  "Potencia",
  "Certificación",
  "Conexión",
  "Switches",
  "Iluminación",
  "Wi-Fi",
];
const MAXIMO_DE_FACETAS = 6;
const PREFIJO = "f-";
const SEPARADOR = "|";

function valorFiltrable(producto: ProductoPublico, clave: string): string | null {
  const valor = valorDe(paresDeFicha(producto), clave);
  return valor ? valorCorto(clave, valor) : null;
}

function contar(valores: Array<string | null>): OpcionDeFiltro[] {
  const cuenta = new Map<string, number>();
  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  return [...cuenta.entries()]
    .map(([valor, cantidad]) => ({ valor, cantidad }))
    .sort((a, b) => a.valor.localeCompare(b.valor, "es", { numeric: true }));
}

export function marcasDe(productos: ProductoPublico[]): OpcionDeFiltro[] {
  return contar(productos.map((p) => p.marca)).sort((a, b) => b.cantidad - a.cantidad || a.valor.localeCompare(b.valor, "es"));
}

/** Las claves presentes en al menos un tercio de los productos y con dos a doce valores distintos. */
export function facetasDe(productos: ProductoPublico[]): Faceta[] {
  if (productos.length < 2) return [];
  const facetas: Faceta[] = [];
  for (const clave of CLAVES_FILTRABLES) {
    if (facetas.length >= MAXIMO_DE_FACETAS) break;
    const valores = productos.map((p) => valorFiltrable(p, clave));
    const conValor = valores.filter(Boolean).length;
    const opciones = contar(valores);
    if (conValor / productos.length >= 1 / 3 && opciones.length >= 2 && opciones.length <= 12) facetas.push({ clave, opciones });
  }
  return facetas;
}

export function aplicarFiltros(productos: ProductoPublico[], seleccion: SeleccionDeFiltros): ProductoPublico[] {
  return productos.filter((p) => {
    if (seleccion.soloStock && !p.hay_stock) return false;
    if (seleccion.marcas.length > 0 && !seleccion.marcas.includes(p.marca ?? "")) return false;
    const precio = p.precio_final_ars;
    if (seleccion.min !== null && (precio === null || precio < seleccion.min)) return false;
    if (seleccion.max !== null && (precio === null || precio > seleccion.max)) return false;
    for (const [clave, elegidos] of Object.entries(seleccion.facetas)) {
      if (elegidos.length === 0) continue;
      const valor = valorFiltrable(p, clave);
      if (!valor || !elegidos.includes(valor)) return false;
    }
    return true;
  });
}

export function ordenarProductos(productos: ProductoPublico[], orden: OrdenDelCatalogo): ProductoPublico[] {
  const copia = [...productos];
  const precio = (p: ProductoPublico) => p.precio_final_ars ?? Number.POSITIVE_INFINITY;
  switch (orden) {
    case "precio_asc":
      return copia.sort((a, b) => precio(a) - precio(b));
    case "precio_desc":
      return copia.sort((a, b) => (b.precio_final_ars ?? -1) - (a.precio_final_ars ?? -1));
    case "nuevos":
      return copia.sort((a, b) => b.id - a.id);
    case "nombre":
      return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    case "destacados":
    default:
      return copia.sort(
        (a, b) => Number(b.destacado) - Number(a.destacado) || Number(b.hay_stock) - Number(a.hay_stock) || a.nombre.localeCompare(b.nombre, "es"),
      );
  }
}

function lista(valor: string | null): string[] {
  return valor ? valor.split(SEPARADOR).map((v) => v.trim()).filter(Boolean) : [];
}

function numero(valor: string | null): number | null {
  if (!valor) return null;
  const n = Number(valor.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function leerSeleccion(parametros: URLSearchParams): SeleccionDeFiltros {
  const facetas: Record<string, string[]> = {};
  parametros.forEach((valor, clave) => {
    if (clave.startsWith(PREFIJO)) facetas[clave.slice(PREFIJO.length)] = lista(valor);
  });
  return {
    marcas: lista(parametros.get("marca")),
    facetas,
    min: numero(parametros.get("min")),
    max: numero(parametros.get("max")),
    soloStock: parametros.get("stock") === "1",
  };
}

/** Escribe la selección en la URL y conserva lo que no es filtro (orden, búsqueda, categoría del buscador). */
export function escribirSeleccion(base: URLSearchParams, seleccion: SeleccionDeFiltros): URLSearchParams {
  const siguiente = new URLSearchParams();
  base.forEach((valor, clave) => {
    if (clave.startsWith(PREFIJO) || ["marca", "min", "max", "stock"].includes(clave)) return;
    siguiente.set(clave, valor);
  });
  if (seleccion.marcas.length > 0) siguiente.set("marca", seleccion.marcas.join(SEPARADOR));
  for (const [clave, elegidos] of Object.entries(seleccion.facetas)) {
    if (elegidos.length > 0) siguiente.set(`${PREFIJO}${clave}`, elegidos.join(SEPARADOR));
  }
  if (seleccion.min !== null) siguiente.set("min", String(seleccion.min));
  if (seleccion.max !== null) siguiente.set("max", String(seleccion.max));
  if (seleccion.soloStock) siguiente.set("stock", "1");
  return siguiente;
}

export function cantidadDeFiltros(seleccion: SeleccionDeFiltros): number {
  return (
    seleccion.marcas.length +
    Object.values(seleccion.facetas).reduce((s, v) => s + v.length, 0) +
    (seleccion.min !== null ? 1 : 0) +
    (seleccion.max !== null ? 1 : 0) +
    (seleccion.soloStock ? 1 : 0)
  );
}

export const SIN_FILTROS: SeleccionDeFiltros = { marcas: [], facetas: {}, min: null, max: null, soloStock: false };
