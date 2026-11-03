import { useEffect, useState } from "react";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { Marcas as GrillaDeMarcas } from "@/components/tienda/inicio/Marcas";
import { Skeleton } from "@/components/ui/skeleton";
import { listarMarcas, type MarcaPublica } from "@/lib/tienda/portada";
import { useSeo } from "@/lib/tienda/seo";

/** Todas las marcas con productos a la vista. */
export default function Marcas() {
  useSeo("Marcas", "Las marcas de notebooks, gaming, monitores y periféricos que vendemos, con envío a todo el país.");
  const [marcas, setMarcas] = useState<MarcaPublica[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarMarcas()
      .then((lista) => {
        if (!cancelado) setMarcas(lista);
      })
      .catch(() => {
        if (!cancelado) setMarcas([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <Tienda>
      <div className="container mx-auto px-4 pt-8">
        <MigasDePan migas={[{ nombre: "Marcas" }]} />
      </div>
      {marcas === null ? (
        <div className="container mx-auto grid grid-cols-2 gap-3 px-4 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : marcas.length === 0 ? (
        <p className="container mx-auto px-4 py-12 text-muted-foreground">Todavía no hay marcas con productos a la vista.</p>
      ) : (
        <GrillaDeMarcas marcas={marcas} principal />
      )}
    </Tienda>
  );
}
