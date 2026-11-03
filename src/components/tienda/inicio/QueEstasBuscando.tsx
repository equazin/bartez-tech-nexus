import { Link } from "react-router-dom";
import type { CategoriaPublica } from "@/lib/tienda/catalogo";
import { accesosConProductos } from "@/lib/tienda/portada";

/** Las categorías del menú con su cantidad y, debajo, los accesos directos a subcategorías con productos. */
export function QueEstasBuscando({ raices }: { raices: CategoriaPublica[] }) {
  const categorias = raices.filter((c) => c.cantidad > 0);
  const accesos = accesosConProductos(raices);
  if (categorias.length === 0) return null;

  return (
    <section className="container mx-auto space-y-5 px-4 py-10 lg:py-14" aria-labelledby="que-buscas-titulo">
      <h2 id="que-buscas-titulo" className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">
        Qué estás buscando
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {categorias.map((categoria) => (
          <li key={categoria.id}>
            <Link
              to={`/${categoria.slug}`}
              className="flex h-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-bold">{categoria.nombre}</span>
              <span className="text-sm tabular-nums text-muted-foreground">{categoria.cantidad}</span>
            </Link>
          </li>
        ))}
      </ul>
      {accesos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Accesos directos">
          {accesos.map((acceso) => (
            <li key={acceso.slug}>
              <Link
                to={`/${acceso.slug}`}
                className="inline-flex h-9 items-center rounded-chip bg-secondary px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {acceso.etiqueta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
