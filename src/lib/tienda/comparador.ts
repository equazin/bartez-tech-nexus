import { useSyncExternalStore } from "react";

/**
 * Los productos marcados para comparar, hasta tres. Viven en localStorage como el carrito
 * y avisan a la interfaz con un evento; los datos se vuelven a leer de la vista pública al comparar.
 */

const CLAVE = "teqo_comparar";
const EVENTO = "teqo:comparar";
export const MAXIMO_A_COMPARAR = 3;

export interface ProductoAComparar {
  id: number;
  slug: string;
  nombre: string;
  marca: string | null;
  imagen: string | null;
  categoria_slug: string | null;
}

const VACIO: ProductoAComparar[] = [];

function leer(): ProductoAComparar[] {
  if (typeof window === "undefined") return VACIO;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return VACIO;
    const lista = JSON.parse(crudo) as unknown;
    if (!Array.isArray(lista)) return VACIO;
    return lista
      .filter((p): p is ProductoAComparar => typeof p?.id === "number" && typeof p?.slug === "string")
      .slice(0, MAXIMO_A_COMPARAR);
  } catch {
    return VACIO;
  }
}

function guardar(lista: ProductoAComparar[]): ProductoAComparar[] {
  if (typeof window === "undefined") return lista;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento: la comparación dura lo que esta vista.
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
  return lista;
}

export type ResultadoDeComparar = "agregado" | "quitado" | "lleno";

/** Marca o desmarca un producto. Con tres marcados no suma otro y avisa "lleno". */
export function alternarComparacion(producto: ProductoAComparar): ResultadoDeComparar {
  const actual = leer();
  if (actual.some((p) => p.id === producto.id)) {
    guardar(actual.filter((p) => p.id !== producto.id));
    return "quitado";
  }
  if (actual.length >= MAXIMO_A_COMPARAR) return "lleno";
  guardar([...actual, producto]);
  return "agregado";
}

export function quitarDeComparacion(id: number): void {
  guardar(leer().filter((p) => p.id !== id));
}

export function vaciarComparacion(): void {
  guardar([]);
}

let ultimoTexto: string | null = null;
let ultimaLista: ProductoAComparar[] = VACIO;

function instantanea(): ProductoAComparar[] {
  if (typeof window === "undefined") return VACIO;
  let texto: string | null = null;
  try {
    texto = window.localStorage.getItem(CLAVE);
  } catch {
    texto = null;
  }
  if (texto !== ultimoTexto) {
    ultimoTexto = texto;
    ultimaLista = leer();
  }
  return ultimaLista;
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useComparador(): ProductoAComparar[] {
  return useSyncExternalStore(suscribir, instantanea, () => VACIO);
}
