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
  chipsDeCategoria,
  contarPorCategoria,
  encontrarCategoria,
  filtroDeCategoria,
  listarCategorias,
  listarMarcasDeCategoria,
  listarProductos,
  rutaDeCategoria,
  type CategoriaPublica,
  type OrdenDelCatalogo,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import { useSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

const CLASE_CHIP =
  "inline-flex h-9 items-center rounded-chip px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const [conteoDeVista, setConteoDeVista] = useState<Map<number, number> | undefined>(undefined);

  const ordenParametro = parametros.get("orden");
  const orden: OrdenDelCatalogo = esOrden(ordenParametro) ? ordenParametro : "destacados";
  const marcaId = parametros.get("marca");
  const subSlug = parametros.get("sub");

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
  // En una vista transversal (Gaming), ?sub= filtra por una categoría de cualquier rama.
  const sub = useMemo(() => (raices && nodo?.incluye_etiqueta && subSlug ? encontrarCategoria(raices, subSlug) : null), [raices, nodo, subSlug]);
  const filtro = useMemo(() => (nodo ? filtroDeCategoria(nodo, sub) : null), [nodo, sub]);
  const filtroDeLaVista = useMemo(() => (nodo?.incluye_etiqueta ? filtroDeCategoria(nodo) : null), [nodo]);
  const migas = useMemo(() => (raices && nodo ? rutaDeCategoria(raices, nodo.id) : []), [raices, nodo]);
  const claveIds = filtro ? `${filtro.categoriaIds.join(",")}|${filtro.etiqueta ?? ""}|${filtro.unirConEtiqueta}` : "";
  const chips = useMemo(() => (raices && nodo ? chipsDeCategoria(raices, nodo, conteoDeVista) : []), [raices, nodo, conteoDeVista]);

  useSeo(nodo ? nodo.nombre : null, nodo ? `${nodo.nombre} con envío a todo el país y precios finales con IVA incluido.` : null);

  useEffect(() => {
    setPagina(0);
  }, [claveIds, orden, marcaId]);

  useEffect(() => {
    if (!nodo || !filtro) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    listarProductos({ filtro, marcaId, orden, pagina })
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
    if (!filtro) return;
    let cancelado = false;
    listarMarcasDeCategoria(filtro)
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

  useEffect(() => {
    if (!filtroDeLaVista) {
      setConteoDeVista(undefined);
      return;
    }
    let cancelado = false;
    contarPorCategoria(filtroDeLaVista)
      .then((conteo) => {
        if (!cancelado) setConteoDeVista(conteo);
      })
      .catch(() => {
        if (!cancelado) setConteoDeVista(new Map());
      });
    return () => {
      cancelado = true;
    };
  }, [filtroDeLaVista]);

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

        {nodo && chips.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Subcategorías">
            {nodo.incluye_etiqueta && (
              <li>
                <Link to={`/${nodo.slug}`} aria-current={!sub ? "page" : undefined} className={cn(CLASE_CHIP, !sub ? "bg-accent text-foreground" : "bg-secondary hover:bg-accent")}>
                  Todo <span className="ml-1.5 tabular-nums text-muted-foreground">{nodo.cantidad}</span>
                </Link>
              </li>
            )}
            {chips.map(({ categoria, cantidad, etiqueta }) => {
              const activo = sub?.id === categoria.id;
              const destino = nodo.incluye_etiqueta ? `/${nodo.slug}?sub=${encodeURIComponent(categoria.slug)}` : `/${categoria.slug}`;
              return (
                <li key={categoria.id}>
                  <Link to={destino} aria-current={activo ? "page" : undefined} className={cn(CLASE_CHIP, activo ? "bg-accent text-foreground" : "bg-secondary hover:bg-accent")}>
                    {etiqueta} <span className="ml-1.5 tabular-nums text-muted-foreground">{cantidad}</span>
                  </Link>
                </li>
              );
            })}
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
