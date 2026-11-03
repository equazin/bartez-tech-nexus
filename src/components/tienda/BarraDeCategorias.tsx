import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { listarCategorias, type CategoriaPublica } from "@/lib/tienda/catalogo";
import { cn } from "@/lib/utils";

/** Las categorías raíz como enlaces, en una fila que se desplaza en celular. */
export function BarraDeCategorias() {
  const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setCategorias(lista.filter((c) => c.cantidad > 0));
      })
      .catch(() => {
        if (!cancelado) setCategorias([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (categorias.length === 0) return null;

  return (
    <nav aria-label="Categorías" className="border-b border-border bg-background">
      <ul className="container mx-auto flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
        {categorias.map((categoria) => (
          <li key={categoria.id} className="shrink-0">
            <NavLink
              to={`/${categoria.slug}`}
              className={({ isActive }) =>
                cn(
                  "inline-flex h-9 items-center rounded-chip px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              {categoria.nombre}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
