import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { ListadoFiltrable } from "@/components/tienda/ListadoFiltrable";
import { PreguntasFrecuentes } from "@/components/tienda/PreguntasFrecuentes";
import {
  encontrarCategoria,
  fotoDeCategoria,
  fotosPorCategoria,
  idsConDescendientes,
  listarCategorias,
  listarProductos,
  rutaDeCategoria,
  type CategoriaPublica,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import { usarSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

/** Las subcategorías para elegir arriba: las hijas, o las hermanas si la categoría no tiene hijas. */
function accesosDe(nodo: CategoriaPublica, migas: CategoriaPublica[]): { lista: CategoriaPublica[]; madre: CategoriaPublica | null } {
  const hijas = nodo.hijas.filter((h) => h.cantidad > 0);
  if (hijas.length > 0) return { lista: hijas, madre: null };
  const madre = migas.length >= 2 ? migas[migas.length - 2] : null;
  return { lista: madre ? madre.hijas.filter((h) => h.cantidad > 0) : [], madre };
}

export default function Categoria() {
  const { categoria: slug = "" } = useParams<{ categoria: string }>();
  const [raices, setRaices] = useState<CategoriaPublica[] | null>(null);
  const [fotos, setFotos] = useState<Map<number, string>>(new Map());
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setRaices(lista);
      })
      .catch(() => {
        if (!cancelado) setRaices([]);
      });
    fotosPorCategoria().then((mapa) => {
      if (!cancelado) setFotos(mapa);
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
    if (!nodo) return;
    let cancelado = false;
    setCargando(true);
    setError(null);
    setProductos([]);
    listarProductos({ categoriaIds: ids, orden: "destacados", porPagina: 1000 })
      .then((resultado) => {
        if (!cancelado) setProductos(resultado.productos);
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
  }, [nodo?.id, claveIds]);

  if (raices && !nodo) {
    return (
      <Tienda>
        <NoEncontrado titulo="No encontramos esta categoría" />
      </Tienda>
    );
  }

  const accesos = nodo ? accesosDe(nodo, migas) : { lista: [], madre: null };

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-5 px-4 pb-6 pt-5">
        <MigasDePan migas={migas.map((m, i) => (i === migas.length - 1 ? { nombre: m.nombre } : { nombre: m.nombre, ruta: `/${m.slug}` }))} />

        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex max-w-[720px] flex-col gap-2">
            <h1 className="font-display text-[36px] font-bold uppercase leading-none md:text-[44px]">{nodo?.nombre ?? "Categoría"}</h1>
            {nodo?.descripcion && <p className="text-base leading-relaxed text-muted-foreground">{nodo.descripcion}</p>}
          </div>
          {!cargando && <span className="text-[15px] text-muted-foreground">{productos.length === 1 ? "1 producto" : `${productos.length} productos`}</span>}
        </div>

        {accesos.lista.length > 0 && (
          <ul className="flex flex-wrap gap-2.5" aria-label="Subcategorías">
            {accesos.madre && (
              <li>
                <Link to={`/${accesos.madre.slug}`} className="flex h-[52px] items-center rounded-chip border border-border bg-card px-[18px] text-[15px] font-bold hover:border-input">
                  Todo {accesos.madre.nombre.toLowerCase()}
                </Link>
              </li>
            )}
            {accesos.lista.map((c) => {
              const activa = c.id === nodo?.id;
              const foto = fotoDeCategoria(c, fotos);
              return (
                <li key={c.id}>
                  <Link
                    to={`/${c.slug}`}
                    aria-current={activa ? "page" : undefined}
                    className={cn(
                      "flex h-[52px] items-center gap-2.5 rounded-chip border pl-2 pr-[18px] text-[15px] font-bold transition-colors",
                      activa ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-input",
                    )}
                  >
                    <span className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full bg-placa-foto">
                      {foto && <img src={foto} alt="" className="h-[30px] w-[30px] object-contain mix-blend-multiply" />}
                    </span>
                    {c.nombre}
                    <span className="font-medium tabular-nums opacity-75">{c.cantidad}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <ListadoFiltrable productos={productos} cargando={cargando} error={error} textoVacio="Todavía no hay productos en esta categoría." />
      </div>
      <PreguntasFrecuentes />
    </Tienda>
  );
}
