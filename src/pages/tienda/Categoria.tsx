import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import {
  ORDENES,
  POR_PAGINA,
  encontrarCategoria,
  idsConDescendientes,
  listarCategorias,
  listarMarcasDeCategoria,
  listarProductos,
  rutaDeCategoria,
  type CategoriaPublica,
  type OrdenDelCatalogo,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import { usarSeo } from "@/lib/tienda/seo";

const CLASE_SELECT =
  "h-11 rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function esOrden(valor: string | null): valor is OrdenDelCatalogo {
  return ORDENES.some((o) => o.valor === valor);
}

export default function Categoria() {
  const { categoria: slug = "" } = useParams<{ categoria: string }>();
  const [parametros, setParametros] = useSearchParams();

  const [raices, setRaices] = useState<CategoriaPublica[] | null>(null);
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marcas, setMarcas] = useState<Array<{ id: string; nombre: string }>>([]);

  const ordenParametro = parametros.get("orden");
  const orden: OrdenDelCatalogo = esOrden(ordenParametro) ? ordenParametro : "destacados";
  const marcaId = parametros.get("marca");

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setRaices(lista);
      })
      .catch(() => {
        if (!cancelado) setRaices([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const nodo = useMemo(() => (raices ? encontrarCategoria(raices, slug) : null), [raices, slug]);
  const ids = useMemo(() => (nodo ? idsConDescendientes(nodo) : []), [nodo]);
  const migas = useMemo(() => (raices && nodo ? rutaDeCategoria(raices, nodo.id) : []), [raices, nodo]);
  const claveIds = ids.join(",");

  usarSeo(nodo ? nodo.nombre : null, nodo ? (nodo.descripcion ?? `${nodo.nombre} con envío a todo el país y precios finales con IVA incluido.`) : null);

  useEffect(() => {
    setPagina(0);
  }, [claveIds, orden, marcaId]);

  useEffect(() => {
    if (!nodo) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    listarProductos({ categoriaIds: ids, marcaId, orden, pagina })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodo, claveIds, marcaId, orden, pagina]);

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelado = false;
    listarMarcasDeCategoria(ids)
      .then((lista) => {
        if (!cancelado) setMarcas(lista);
      })
      .catch(() => {
        if (!cancelado) setMarcas([]);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveIds]);

  function cambiarParametro(clave: string, valor: string) {
    const siguientes = new URLSearchParams(parametros);
    if (valor) siguientes.set(clave, valor);
    else siguientes.delete(clave);
    setParametros(siguientes, { replace: true });
  }

  if (raices && !nodo) {
    return (
      <Tienda>
        <NoEncontrado titulo="No encontramos esta categoría" />
      </Tienda>
    );
  }

  const hayMas = productos.length < total;

  return (
    <Tienda>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <MigasDePan migas={migas.map((m, i) => (i === migas.length - 1 ? { nombre: m.nombre } : { nombre: m.nombre, ruta: `/${m.slug}` }))} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">{nodo?.nombre ?? "Categoría"}</h1>
            {nodo?.descripcion && <p className="mt-3 max-w-2xl text-muted-foreground">{nodo.descripcion}</p>}
            {!cargando && <p className="mt-1 text-sm text-muted-foreground">{total === 1 ? "1 producto" : `${total} productos`}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {marcas.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="sr-only">Marca</span>
                <select value={marcaId ?? ""} onChange={(e) => cambiarParametro("marca", e.target.value)} className={CLASE_SELECT} aria-label="Marca">
                  <option value="">Todas las marcas</option>
                  {marcas.map((marca) => (
                    <option key={marca.id} value={marca.id}>
                      {marca.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Ordenar</span>
              <select value={orden} onChange={(e) => cambiarParametro("orden", e.target.value === "destacados" ? "" : e.target.value)} className={CLASE_SELECT} aria-label="Ordenar">
                {ORDENES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {nodo && nodo.hijas.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Subcategorías">
            {nodo.hijas
              .filter((h) => h.cantidad > 0)
              .map((hija) => (
                <li key={hija.id}>
                  <Link to={`/${hija.slug}`} className="inline-flex h-9 items-center rounded-chip bg-secondary px-3 text-sm font-medium hover:bg-accent">
                    {hija.nombre} <span className="ml-1.5 tabular-nums text-muted-foreground">{hija.cantidad}</span>
                  </Link>
                </li>
              ))}
          </ul>
        )}

        {error ? (
          <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>
        ) : !cargando && productos.length === 0 ? (
          <p className="py-12 text-muted-foreground">Todavía no hay productos en esta categoría.</p>
        ) : (
          <GrillaProductos productos={productos} cargando={cargando} cantidadEsqueletos={POR_PAGINA / 2} />
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
