import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Encabezado } from "./Encabezado";
import { BarraDeCategorias } from "./BarraDeCategorias";
import { Pie } from "./Pie";

/** Estructura de todas las páginas públicas: encabezado, barra de categorías, contenido y pie. */
export function Tienda({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Encabezado />
      <BarraDeCategorias />
      <main className="flex-1">{children}</main>
      <Pie />
    </div>
  );
}
