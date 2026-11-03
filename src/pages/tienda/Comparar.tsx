import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { TablaComparativa } from "@/components/tienda/TablaComparativa";
import { EstadoDeStock, agregarYAvisar } from "@/components/tienda/TarjetaProducto";
import { PreciosDelProducto } from "@/components/tienda/Precio";
import { imagenPrincipal, listarProductosPorIds, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { quitarDeComparacion, useComparador, vaciarComparacion } from "@/lib/tienda/comparador";
import { usarSeo } from "@/lib/tienda/seo";

/** Hasta tres productos lado a lado: foto, precio y la ficha completa con lo que mejora resaltado. */
export default function Comparar() {
  usarSeo("Comparar productos", "Compará hasta tres productos lado a lado.");
  const marcados = useComparador();
  const claveIds = marcados.map((p) => p.id).join(",");
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const ids = marcados.map((p) => p.id);
    if (ids.length === 0) {
      setProductos([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    listarProductosPorIds(ids)
      .then((lista) => {
        if (cancelado) return;
        const porId = new Map(lista.map((p) => [p.id, p]));
        setProductos(ids.map((id) => porId.get(id)).filter((p): p is ProductoPublico => Boolean(p)));
      })
      .catch(() => {
        if (!cancelado) setProductos([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveIds]);

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-6 px-4 pb-6 pt-5">
        <MigasDePan migas={[{ nombre: "Comparar" }]} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[36px] font-bold uppercase leading-none md:text-[44px]">Comparar</h1>
            <p className="text-base text-muted-foreground">Lo que mejora en cada fila queda resaltado.</p>
          </div>
          {marcados.length > 0 && (
            <button type="button" onClick={vaciarComparacion} className="h-11 rounded-xl border border-input px-4 text-sm font-bold hover:bg-secondary">
              Vaciar la comparación
            </button>
          )}
        </div>

        {marcados.length < 2 && !cargando ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-8">
            <p className="text-lg font-bold">{marcados.length === 0 ? "Todavía no marcaste productos" : "Falta uno más para comparar"}</p>
            <p className="text-sm text-muted-foreground">En cualquier lista de productos tocá "Comparar" en hasta tres tarjetas.</p>
            <Link to="/" className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Ir a la tienda
            </Link>
          </div>
        ) : (
          <>
            <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(productos.length, 1)}, minmax(0, 1fr))` }}>
              {productos.map((p) => {
                const foto = imagenPrincipal(p);
                return (
                  <li key={p.id} className="relative flex min-w-0 flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
                    <button
                      type="button"
                      onClick={() => quitarDeComparacion(p.id)}
                      aria-label={`Quitar ${p.nombre}`}
                      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-background hover:bg-secondary"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                    <Link to={rutaDelProducto(p)} className="flex h-[170px] items-center justify-center rounded-xl bg-placa-foto">
                      {foto && <img src={foto} alt={p.nombre} className="max-h-[146px] max-w-[86%] object-contain mix-blend-multiply" />}
                    </Link>
                    {p.marca && <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{p.marca}</p>}
                    <Link to={rutaDelProducto(p)} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
                      {p.nombre}
                    </Link>
                    <PreciosDelProducto producto={p} />
                    <EstadoDeStock producto={p} />
                    <button
                      type="button"
                      disabled={!p.hay_stock || p.precio_final_ars === null}
                      onClick={() => agregarYAvisar(p)}
                      className="mt-auto h-10 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground"
                    >
                      Agregar al carrito
                    </button>
                  </li>
                );
              })}
            </ul>
            {productos.length >= 2 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <TablaComparativa productos={productos} />
              </div>
            )}
          </>
        )}
      </div>
    </Tienda>
  );
}
