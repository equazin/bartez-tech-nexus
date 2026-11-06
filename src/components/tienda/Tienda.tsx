import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Encabezado } from "./Encabezado";
import { Pie } from "./Pie";
import { AvisoDeCookies } from "./AvisoDeCookies";
import { BandejaComparador } from "./BandejaComparador";

/** Estructura de todas las páginas públicas: encabezado con menú de categorías, contenido, pie y comparador. */
export function Tienda({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Encabezado />
      <main className="flex-1">{children}</main>
      <Pie />
      <BandejaComparador />
      <AvisoDeCookies />
    </div>
  );
}
