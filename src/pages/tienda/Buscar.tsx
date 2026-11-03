import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tienda } from "@/components/tienda/Tienda";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import { buscarProductos, type ProductoPublico } from "@/lib/tienda/catalogo";
import { useSeo } from "@/lib/tienda/seo";

export default function Buscar() {
  const [parametros] = useSearchParams();
  const q = (parametros.get("q") ?? "").trim();
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSeo(q ? `Resultados para "${q}"` : "Buscar");

  useEffect(() => {
    if (q.length < 2) {
      setProductos([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    buscarProductos(q)
      .then((lista) => {
        if (!cancelado) setProductos(lista);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo buscar.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [q]);

  return (
    <Tienda>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <div>
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">{q ? `Resultados para "${q}"` : "Buscar"}</h1>
          {q.length >= 2 && !cargando && !error && (
            <p className="mt-1 text-sm text-muted-foreground">{productos.length === 1 ? "1 producto" : `${productos.length} productos`}</p>
          )}
        </div>

        {q.length < 2 ? (
          <p className="text-muted-foreground">Escribí al menos dos letras en el buscador de arriba.</p>
        ) : error ? (
          <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>
        ) : !cargando && productos.length === 0 ? (
          <p className="py-12 text-muted-foreground">No encontramos productos con ese nombre. Probá con la marca o el modelo.</p>
        ) : (
          <GrillaProductos productos={productos} cargando={cargando} />
        )}
      </div>
    </Tienda>
  );
}
