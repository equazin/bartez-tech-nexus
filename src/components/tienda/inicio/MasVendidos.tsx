import { useMemo, useState } from "react";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import type { ProductoPublico } from "@/lib/tienda/catalogo";
import { marcasPresentes, type MasVendidos as Datos } from "@/lib/tienda/portada";
import { cn } from "@/lib/utils";
import { BloqueDeProductos } from "./BloqueDeProductos";

const CLASE_CHIP =
  "inline-flex h-9 items-center rounded-chip px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const VISIBLES = 8;

/** Lo más vendido de las últimas cuatro semanas (o los destacados, mientras no haya ventas), con chips de marca. */
export function MasVendidos({ datos, cargando, verTodo }: { datos: Datos | null; cargando: boolean; verTodo?: string }) {
  const [marca, setMarca] = useState<string | null>(null);
  const productos: ProductoPublico[] = useMemo(() => datos?.productos ?? [], [datos]);
  const marcas = useMemo(() => marcasPresentes(productos), [productos]);
  const filtrados = useMemo(() => (marca ? productos.filter((p) => p.marca_id === marca) : productos).slice(0, VISIBLES), [productos, marca]);

  if (!cargando && productos.length === 0) return null;
  const titulo = datos?.origen === "ventas" ? "Lo más vendido" : "Destacados";

  return (
    <BloqueDeProductos
      id="mas-vendidos"
      titulo={titulo}
      bajada={datos?.origen === "ventas" ? "Lo que más se llevó en las últimas cuatro semanas." : undefined}
      verTodo={verTodo ? { ruta: verTodo } : undefined}
    >
      {marcas.length > 1 && (
        <ul className="mb-5 flex flex-wrap gap-2" aria-label="Filtrar por marca">
          <li>
            <button type="button" aria-pressed={marca === null} onClick={() => setMarca(null)} className={cn(CLASE_CHIP, marca === null ? "bg-accent text-foreground" : "bg-secondary hover:bg-accent")}>
              Todas
            </button>
          </li>
          {marcas.map((m) => (
            <li key={m.id}>
              <button type="button" aria-pressed={marca === m.id} onClick={() => setMarca(m.id)} className={cn(CLASE_CHIP, marca === m.id ? "bg-accent text-foreground" : "bg-secondary hover:bg-accent")}>
                {m.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      <GrillaProductos productos={filtrados} cargando={cargando} />
    </BloqueDeProductos>
  );
}
