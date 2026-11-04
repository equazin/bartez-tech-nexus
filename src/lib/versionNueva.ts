/**
 * Después de cada publicación los archivos de la versión anterior dejan de existir. Una pestaña que quedó abierta con
 * la versión vieja, al cambiar de página, pide un archivo que ya no está y falla ("Failed to fetch dynamically imported
 * module"). La salida es recargar: el navegador trae la versión nueva. Se recarga una sola vez cada 30 segundos para
 * no entrar en un ciclo si el problema es otro (sin conexión, por ejemplo).
 */

const CLAVE = "teqo:recarga-por-version-nueva";
const ESPERA_MS = 30_000;

export function esErrorDeVersionVieja(error: unknown): boolean {
  const mensaje = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    mensaje.includes("dynamically imported module") ||
    mensaje.includes("importing a module script failed") ||
    mensaje.includes("chunkloaderror") ||
    mensaje.includes("loading chunk") ||
    mensaje.includes("unable to preload css")
  );
}

/** Recarga la página si no se recargó por lo mismo en los últimos 30 segundos. Devuelve si recargó. */
export function recargarPorVersionNueva(): boolean {
  try {
    const ultima = Number(window.sessionStorage.getItem(CLAVE) ?? 0);
    if (Date.now() - ultima < ESPERA_MS) return false;
    window.sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin almacenamiento (modo privado): se recarga igual; el navegador no repite si la versión nueva carga bien.
  }
  window.location.reload();
  return true;
}

/** Escucha las fallas de carga de archivos de Vite y las promesas rechazadas por lo mismo. */
export function escucharVersionNueva(): void {
  window.addEventListener("vite:preloadError", (evento) => {
    evento.preventDefault();
    recargarPorVersionNueva();
  });
  window.addEventListener("unhandledrejection", (evento) => {
    if (esErrorDeVersionVieja(evento.reason)) recargarPorVersionNueva();
  });
}
