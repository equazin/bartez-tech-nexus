import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { opcionesDeCategoria, type CategoriaDelPanel } from "@/lib/api/categorias";

/**
 * Catálogo › Categorías › Categorías de los mayoristas.
 * Cada texto de categoría que llega de un mayorista, de la planilla o del panel y no es una
 * categoría de Teqo se mapea acá una sola vez; lo que ya entró y lo que entre después con ese
 * texto cae en la categoría elegida. Un producto sin categoría de Teqo no aparece en la tienda.
 */

interface FilaDeOrigen {
  origen: string;
  texto: string;
  productos: number;
  activos: number;
  sin_categoria: number;
  categoria_id: number | null;
}

const CLASE_SELECT =
  "h-10 w-full min-w-[220px] rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MapeoDeCategorias({ onCambio }: { onCambio?: () => void }) {
  const [filas, setFilas] = useState<FilaDeOrigen[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDelPanel[]>([]);
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [soloPendientes, setSoloPendientes] = useState(true);

  const cargar = useCallback(async () => {
    setError(null);
    const [origenes, cats] = await Promise.all([
      supabase.rpc("panel_categorias_de_origen"),
      supabase.from("categories").select("id, name, parent_id, active, orden"),
    ]);
    if (origenes.error) throw new Error(origenes.error.message);
    if (cats.error) throw new Error(cats.error.message);
    const lista = (origenes.data ?? []) as FilaDeOrigen[];
    setFilas(lista);
    setCategorias((cats.data ?? []) as CategoriaDelPanel[]);
    setElegidas(Object.fromEntries(lista.map((f) => [f.origen, f.categoria_id ? String(f.categoria_id) : ""])));
  }, []);

  useEffect(() => {
    cargar()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar el mapeo."))
      .finally(() => setCargando(false));
  }, [cargar]);

  const opciones = useMemo(() => opcionesDeCategoria(categorias), [categorias]);
  const nombrePorId = useMemo(() => new Map(opciones.map((o) => [o.id, o.etiqueta])), [opciones]);
  const pendientes = filas.filter((f) => f.sin_categoria > 0);
  const productosSinCategoria = pendientes.reduce((total, f) => total + f.sin_categoria, 0);
  const visibles = soloPendientes ? pendientes : filas;

  async function guardar(fila: FilaDeOrigen) {
    const valor = elegidas[fila.origen] ?? "";
    setGuardando(fila.origen);
    try {
      const { data, error: errorRpc } = await supabase.rpc("panel_mapear_categoria", {
        p_texto: fila.texto,
        p_categoria_id: valor ? Number(valor) : null,
      });
      if (errorRpc) throw new Error(errorRpc.message);
      if (valor) {
        const destino = nombrePorId.get(Number(valor)) ?? "la categoría elegida";
        toast.success(`"${fila.texto}" va a ${destino}`, { description: `${Number(data ?? 0)} productos en esa categoría con este origen.` });
      } else {
        toast.success(`Se quitó el mapeo de "${fila.texto}"`, { description: "Los productos conservan la categoría que ya tenían." });
      }
      await cargar();
      onCambio?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el mapeo.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <SurfaceCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-lg font-bold">Categorías de los mayoristas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada texto de categoría que llega de un mayorista o de la planilla, y la categoría de Teqo a la que va. Se mapea una vez: lo que ya
            entró y lo que entre después con ese texto cae en la categoría elegida. Un producto sin categoría de Teqo no aparece en la tienda.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} className="h-4 w-4" />
          Solo los que tienen productos sin categoría
        </label>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando el mapeo</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <>
          <p className="text-sm">
            {productosSinCategoria === 0
              ? "Todos los productos tienen una categoría de Teqo."
              : `${productosSinCategoria} ${productosSinCategoria === 1 ? "producto sin categoría de Teqo" : "productos sin categoría de Teqo"}, en ${pendientes.length} ${pendientes.length === 1 ? "texto de origen" : "textos de origen"}.`}
          </p>
          {visibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filas.length === 0 ? "Todavía no entró ningún producto con una categoría de afuera." : "No queda nada por mapear."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Texto de origen</th>
                    <th className="py-2 pr-4 text-right font-medium">Productos</th>
                    <th className="py-2 pr-4 text-right font-medium">Sin categoría</th>
                    <th className="py-2 pr-4 font-medium">Categoría de Teqo</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((fila) => {
                    const valor = elegidas[fila.origen] ?? "";
                    const cambio = valor !== (fila.categoria_id ? String(fila.categoria_id) : "");
                    return (
                      <tr key={fila.origen} className="border-b border-border last:border-0">
                        <td className="py-2 pr-4 font-medium">{fila.texto}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {fila.productos}
                          {fila.activos !== fila.productos && <span className="text-muted-foreground"> ({fila.activos} activos)</span>}
                        </td>
                        <td className={cn("py-2 pr-4 text-right tabular-nums", fila.sin_categoria > 0 && "font-bold")}>{fila.sin_categoria}</td>
                        <td className="py-2 pr-4">
                          <select
                            aria-label={`Categoría de Teqo para ${fila.texto}`}
                            value={valor}
                            onChange={(e) => setElegidas({ ...elegidas, [fila.origen]: e.target.value })}
                            className={CLASE_SELECT}
                          >
                            <option value="">Sin mapear</option>
                            {opciones.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.etiqueta}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 text-right">
                          <Button size="sm" disabled={!cambio || guardando !== null} onClick={() => void guardar(fila)}>
                            {guardando === fila.origen ? "Guardando" : "Guardar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </SurfaceCard>
  );
}
