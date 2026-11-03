import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { ListadoFiltrable } from "@/components/tienda/ListadoFiltrable";
import {
  buscarProductos,
  encontrarCategoria,
  idsConDescendientes,
  listarCategorias,
  type CategoriaPublica,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import { usarSeo } from "@/lib/tienda/seo";

export default function Buscar() {
  const [parametros] = useSearchParams();
  const q = (parametros.get("q") ?? "").trim();
  const en = parametros.get("en") ?? "";
  const [resultados, setResultados] = useState<ProductoPublico[]>([]);
  const [raices, setRaices] = useState<CategoriaPublica[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usarSeo(q ? `Resultados para "${q}"` : "Buscar");

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setRaices(lista);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (q.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    buscarProductos(q, 120)
      .then((lista) => {
        if (!cancelado) setResultados(lista);
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

  const categoria = en ? encontrarCategoria(raices, en) : null;
  const productos = useMemo(() => {
    if (!categoria) return resultados;
    const ids = new Set(idsConDescendientes(categoria));
    return resultados.filter((p) => p.categoria_id !== null && ids.has(p.categoria_id));
  }, [resultados, categoria]);

  const titulo = q ? `Resultados para "${q}"` : "Buscar";

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-5 px-4 pb-6 pt-5">
        <MigasDePan migas={[{ nombre: "Buscar" }]} />
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.5px] md:text-[34px]">{titulo}</h1>
          {categoria && <p className="text-[15px] text-muted-foreground">En {categoria.nombre}</p>}
        </div>

        {q.length < 2 ? (
          <p className="text-muted-foreground">Escribí al menos dos letras en el buscador de arriba.</p>
        ) : (
          <ListadoFiltrable
            productos={productos}
            cargando={cargando}
            error={error}
            textoVacio="No encontramos productos con ese nombre. Probá con la marca o el modelo."
          />
        )}
      </div>
    </Tienda>
  );
}
