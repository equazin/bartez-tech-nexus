import { useSyncExternalStore } from "react";

/**
 * Carrito del visitante, sin cuenta: vive en localStorage y avisa a la interfaz con un evento.
 * Guarda solo ids y cantidades; los precios se resuelven siempre en el servidor.
 */

const CLAVE = "teqo_carrito";
const EVENTO = "teqo:carrito";

export interface LineaDelCarrito {
  productoId: number;
  slug: string;
  cantidad: number;
}

export interface Carrito {
  lineas: LineaDelCarrito[];
  /** Los servicios sumados (armado, sistema y drivers...), por id. */
  servicios: string[];
  actualizadoEn: string;
}

const VACIO: Carrito = { lineas: [], servicios: [], actualizadoEn: "" };

function leer(): Carrito {
  if (typeof window === "undefined") return VACIO;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return VACIO;
    const parseado = JSON.parse(crudo) as Partial<Carrito>;
    const lineas = Array.isArray(parseado.lineas)
      ? parseado.lineas
          .filter((l): l is LineaDelCarrito => typeof l?.productoId === "number" && typeof l?.cantidad === "number" && l.cantidad > 0)
          .map((l) => ({ productoId: l.productoId, slug: String(l.slug ?? ""), cantidad: Math.floor(l.cantidad) }))
      : [];
    const servicios = Array.isArray(parseado.servicios) ? parseado.servicios.filter((id): id is string => typeof id === "string").slice(0, 10) : [];
    return { lineas, servicios, actualizadoEn: String(parseado.actualizadoEn ?? "") };
  } catch {
    return VACIO;
  }
}

function guardar(carrito: Carrito): Carrito {
  if (typeof window === "undefined") return carrito;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(carrito));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena): el carrito vive solo en memoria de esta vista.
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
  return carrito;
}

function ahora(): string {
  return new Date().toISOString();
}

export function agregarAlCarrito(productoId: number, slug: string, cantidad = 1): Carrito {
  const actual = leer();
  const existente = actual.lineas.find((l) => l.productoId === productoId);
  const lineas = existente
    ? actual.lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: l.cantidad + cantidad } : l))
    : [...actual.lineas, { productoId, slug, cantidad }];
  return guardar({ ...actual, lineas, actualizadoEn: ahora() });
}

export function cambiarCantidad(productoId: number, cantidad: number): Carrito {
  const actual = leer();
  const lineas =
    cantidad <= 0
      ? actual.lineas.filter((l) => l.productoId !== productoId)
      : actual.lineas.map((l) => (l.productoId === productoId ? { ...l, cantidad: Math.floor(cantidad) } : l));
  return guardar({ ...actual, lineas, actualizadoEn: ahora() });
}

export function quitarDelCarrito(productoId: number): Carrito {
  return cambiarCantidad(productoId, 0);
}

export function vaciarCarrito(): Carrito {
  return guardar({ lineas: [], servicios: [], actualizadoEn: ahora() });
}

export function alternarServicio(id: string): Carrito {
  const actual = leer();
  const servicios = actual.servicios.includes(id) ? actual.servicios.filter((s) => s !== id) : [...actual.servicios, id];
  return guardar({ ...actual, servicios, actualizadoEn: ahora() });
}

/** Suma servicios sin duplicar (los que trae el armador al agregar todo). */
export function sumarServicios(ids: string[]): Carrito {
  const actual = leer();
  const servicios = [...new Set([...actual.servicios, ...ids])].slice(0, 10);
  return guardar({ ...actual, servicios, actualizadoEn: ahora() });
}

export function unidadesEnElCarrito(carrito: Carrito): number {
  return carrito.lineas.reduce((suma, l) => suma + l.cantidad, 0);
}

let ultimoTexto: string | null = null;
let ultimoCarrito: Carrito = VACIO;

function instantanea(): Carrito {
  if (typeof window === "undefined") return VACIO;
  let texto: string | null = null;
  try {
    texto = window.localStorage.getItem(CLAVE);
  } catch {
    texto = null;
  }
  if (texto !== ultimoTexto) {
    ultimoTexto = texto;
    ultimoCarrito = leer();
  }
  return ultimoCarrito;
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useCarrito(): { carrito: Carrito; unidades: number } {
  const carrito = useSyncExternalStore(suscribir, instantanea, () => VACIO);
  return { carrito, unidades: unidadesEnElCarrito(carrito) };
}
