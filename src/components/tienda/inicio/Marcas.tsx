import { Link } from "react-router-dom";
import { resolveProductImageUrl } from "@/lib/productImage";
import type { MarcaPublica } from "@/lib/tienda/portada";
import { BloqueDeProductos } from "./BloqueDeProductos";

/** Las marcas con productos a la vista; cada una lleva a su listado. */
export function Marcas({ marcas, principal = false }: { marcas: MarcaPublica[]; principal?: boolean }) {
  if (marcas.length === 0) return null;
  return (
    <BloqueDeProductos id="marcas" titulo="Marcas" principal={principal}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {marcas.map((marca) => (
          <li key={marca.id}>
            <Link
              to={`/marcas/${marca.slug}`}
              className="flex h-20 items-center justify-center rounded-2xl border border-border bg-card px-4 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${marca.nombre}, ${marca.cantidad} ${marca.cantidad === 1 ? "producto" : "productos"}`}
            >
              {marca.logo_url ? (
                <img src={resolveProductImageUrl(marca.logo_url)} alt="" loading="lazy" className="max-h-10 w-auto max-w-full object-contain" />
              ) : (
                <span className="text-center font-bold">{marca.nombre}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </BloqueDeProductos>
  );
}
