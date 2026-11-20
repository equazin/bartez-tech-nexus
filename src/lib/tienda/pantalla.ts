import { useSyncExternalStore } from "react";

/** Desde este ancho Tailwind aplica `md:`. Si el corte cambia en tailwind.config.ts, cambiarlo acá también. */
const PANTALLA_ANCHA = "(min-width: 768px)";

function suscribir(avisar: () => void): () => void {
  const consulta = window.matchMedia(PANTALLA_ANCHA);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

const esCelularAhora = (): boolean => !window.matchMedia(PANTALLA_ANCHA).matches;

/**
 * Si la pantalla es más angosta que el corte `md` de Tailwind: celulares y tablets chicas. Se sabe desde el primer
 * dibujo, sin esperar a un efecto, así lo que depende de esto no salta de lugar al cargar. Sirve para cambiar el
 * orden de los bloques; para tamaños y columnas alcanza con las clases `md:`.
 */
export function useEsCelular(): boolean {
  return useSyncExternalStore(suscribir, esCelularAhora, () => false);
}
