import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import { POR_PAGINA, listarProductos, type OrdenDelCatalogo, type ProductoPublico } from "@/lib/tienda/catalogo";
import { definicionDeColeccion, type TipoDeColeccion } from "@/lib/tienda/colecciones";
import { listarMarcas, type MarcaPublica } from "@/lib/tienda/portada";
import { useSeo } from "@/lib/tienda/seo";

/** Ofertas, nuevos ingresos y los productos de una marca: el listado de una categoría con su propio filtro. */
const CLASE_SELECT =
  "h-11 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function Coleccion({ tipo }: { tipo: TipoDeColeccion }) {
  const { marca: slugMarca = "" } = useParams<{ marca: string }>();
  const [parametros, setParametros] = useSearchParams();
  const [marcas, setMarcas] = useState<MarcaPublica[] | null>(tipo === "marca" ? null : []);
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tipo !== "marca") return;
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
  }, [tipo]);

  const marca = useMemo(() => (tipo === "marca" && marcas ? (marcas.find((m) => m.slug === slugMarca) ?? null) : null), [tipo, marcas, slugMarca]);
  const definicion = definicionDeColeccion(tipo, marca);
  const ordenParametro = parametros.get("orden");
  const orden = definicion.ordenes.some((o) => o.valor === ordenParametro) ? (ordenParametro as OrdenDelCatalogo) : definicion.ordenPorDefecto;
  const lista = tipo !== "marca" || marca !== null;
  const claveMarca = marca?.id ?? "";

  useSeo(lista ? definicion.titulo : null, lista ? definicion.bajada : null);

  useEffect(() => {
    setPagina(0);
  }, [tipo, claveMarca, orden]);

  useEffect(() => {
    if (!lista) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    listarProductos({ ...definicion.opciones, marcaId: marca?.id ?? null, orden, pagina })
      .then((resultado) => {
        if (cancelado) return;
        setTotal(resultado.total);
        setProductos((previos) => (pagina === 0 ? resultado.productos : [...previos, ...resultado.productos]));
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
    // definicion.opciones depende solo de tipo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, claveMarca, orden, pagina, lista]);

  function cambiarOrden(valor: string) {
    const siguientes = new URLSearchParams(parametros);
    if (valor && valor !== definicion.ordenPorDefecto) siguientes.set("orden", valor);
    else siguientes.delete("orden");
    setParametros(siguientes, { replace: true });
  }

  if (tipo === "marca" && marcas !== null && marca === null) {
    return (
      <Tienda>
        <NoEncontrado titulo="No encontramos esta marca" />
      </Tienda>
    );
  }

  const hayMas = productos.length < total;

  return (
    <Tienda>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <MigasDePan migas={tipo === "marca" ? [{ nombre: "Marcas", ruta: "/marcas" }, { nombre: definicion.titulo }] : [{ nombre: definicion.titulo }]} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">{definicion.titulo}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {definicion.bajada}
              {!cargando && ` ${total === 1 ? "1 producto" : `${total} productos`}.`}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Ordenar</span>
            <select value={orden} onChange={(e) => cambiarOrden(e.target.value)} className={CLASE_SELECT} aria-label="Ordenar">
              {definicion.ordenes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>
        ) : !cargando && productos.length === 0 ? (
          <p className="py-12 text-muted-foreground">{definicion.vacio}</p>
        ) : (
          <GrillaProductos productos={productos} cargando={cargando || !lista} cantidadEsqueletos={POR_PAGINA / 2} />
        )}

        {hayMas && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="lg" disabled={cargando} onClick={() => setPagina((p) => p + 1)}>
              {cargando ? "Cargando" : "Ver más productos"}
            </Button>
          </div>
        )}
      </div>
    </Tienda>
  );
}
