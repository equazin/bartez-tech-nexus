import { useEffect } from "react";

const NOMBRE = "Teqo";

function fijarMeta(selector: string, atributo: "name" | "property", valor: string, contenido: string) {
  let elemento = document.head.querySelector<HTMLMetaElement>(selector);
  if (!elemento) {
    elemento = document.createElement("meta");
    elemento.setAttribute(atributo, valor);
    document.head.appendChild(elemento);
  }
  elemento.setAttribute("content", contenido);
}

/**
 * Título y descripción de una página de la tienda. Corre después de que la página
 * tiene sus datos, así que pisa los valores genéricos de RouteSeo.
 */
export function usarSeo(titulo: string | null | undefined, descripcion?: string | null) {
  useEffect(() => {
    if (!titulo) return;
    const completo = `${titulo} | ${NOMBRE}`;
    document.title = completo;
    fijarMeta('meta[property="og:title"]', "property", "og:title", completo);
    if (descripcion) {
      fijarMeta('meta[name="description"]', "name", "description", descripcion);
      fijarMeta('meta[property="og:description"]', "property", "og:description", descripcion);
    }
  }, [titulo, descripcion]);
}
