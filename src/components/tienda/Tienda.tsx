import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Encabezado } from "./Encabezado";
import { Pie } from "./Pie";
import { AvisoDeCookies } from "./AvisoDeCookies";
import { BandejaComparador } from "./BandejaComparador";

/** El elemento que nombra el "#algo" de la dirección, o null si no nombra ninguno. */
function parteDeLaPagina(hash: string): HTMLElement | null {
  if (hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

/** Estructura de todas las páginas públicas: encabezado con menú de categorías, contenido, pie y comparador. */
export function Tienda({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const paginaAnterior = useRef<string | null>(null);

  // Cada página arranca arriba, salvo que la dirección apunte a una parte de la página ("/ayuda#contacto"): ahí se
  // lleva esa parte a la vista. Un cambio que no es de página ni nombra una parte que exista no mueve nada.
  // Siempre de un salto: el desplazamiento suave del sitio es para los enlaces dentro de una página; al cambiar de
  // página haría que la nueva apareciera a la altura de la anterior y se fuera corriendo hasta su lugar.
  useEffect(() => {
    const destino = parteDeLaPagina(hash);
    if (destino) destino.scrollIntoView({ behavior: "instant" });
    else if (paginaAnterior.current !== pathname) window.scrollTo({ top: 0, behavior: "instant" });
    paginaAnterior.current = pathname;
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Encabezado />
      {/* Al menos una pantalla de alto: el pie arranca fuera de la vista y no salta cuando llega el contenido. */}
      <main className="min-h-screen flex-1">{children}</main>
      <Pie />
      <BandejaComparador />
      <AvisoDeCookies />
    </div>
  );
}
