import { Link } from "react-router-dom";
import { rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { compararFichas, paresDeFicha, valorCorto } from "@/lib/tienda/ficha";
import { cn } from "@/lib/utils";

interface Props {
  productos: ProductoPublico[];
  /** Solo estas claves, en este orden. Sin claves, toda la ficha. */
  claves?: string[];
  /** Muestra los valores cortos (27", QHD) en lugar del texto completo de la ficha. */
  cortos?: boolean;
  className?: string;
}

/** La comparación lado a lado: una columna por producto y la mejor celda resaltada cuando se puede medir. */
export function TablaComparativa({ productos, claves, cortos = false, className }: Props) {
  const fichas = productos.map((p) => paresDeFicha(p));
  const todas = compararFichas(fichas);
  const filas = claves
    ? claves.map((clave) => todas.find((f) => f.clave.toLowerCase() === clave.toLowerCase())).filter((f): f is (typeof todas)[number] => Boolean(f))
    : todas;
  const precios = productos.map((p) => p.precio_final_ars);
  const conPrecio = precios.filter((p): p is number => p !== null);
  const masBarato = conPrecio.length >= 2 && new Set(conPrecio).size > 1 ? Math.min(...conPrecio) : null;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="border-b border-border px-3 py-2.5 text-left font-medium text-muted-foreground">
              Modelo
            </th>
            {productos.map((p) => (
              <th key={p.id} scope="col" className="border-b border-border px-3 py-2.5 text-left font-bold">
                <Link to={rutaDelProducto(p)} className="line-clamp-2 hover:underline">
                  {[p.marca, p.sku].filter(Boolean).join(" ") || p.nombre}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.clave}>
              <th scope="row" className="border-b border-border px-3 py-2.5 text-left font-medium text-muted-foreground">
                {fila.clave}
              </th>
              {fila.valores.map((valor, i) => (
                <td key={i} className={cn("border-b border-border px-3 py-2.5", fila.mejores[i] && "bg-accent font-bold")}>
                  {valor ? (cortos ? valorCorto(fila.clave, valor) : valor) : <span className="text-muted-foreground">Sin dato</span>}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="px-3 py-2.5 text-left font-medium text-muted-foreground">
              Precio final
            </th>
            {precios.map((precio, i) => (
              <td key={i} className={cn("px-3 py-2.5 font-bold tabular-nums", precio !== null && precio === masBarato && "bg-accent")}>
                {precio !== null ? formatearPesos(precio) : "A confirmar"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
