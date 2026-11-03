import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";
import { formatearPesos } from "@/lib/tienda/dinero";

/**
 * Marketing › Portada: el elegido de la semana, los meses de garantía de la franja de confianza
 * y cuántos días un producto lleva la etiqueta Nuevo. Guarda por panel_guardar_portada (solo admin).
 */

interface ProductoElegible {
  id: number;
  nombre: string;
  marca: string | null;
  precio_final_ars: number | null;
  hay_stock: boolean;
}

interface ElegidoGuardado {
  producto_id: number;
  datos?: string[];
  razones?: string[];
  desde?: string;
}

const COLUMNAS = "id, nombre, marca, precio_final_ars, hay_stock";
const CLASE_TEXTAREA =
  "flex min-h-[64px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function completar(lista: string[] | undefined, largo: number): string[] {
  return Array.from({ length: largo }, (_, i) => lista?.[i] ?? "");
}

export function PortadaTab() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [producto, setProducto] = useState<ProductoElegible | null>(null);
  const [datos, setDatos] = useState<string[]>(completar([], 4));
  const [razones, setRazones] = useState<string[]>(completar([], 3));
  const [desde, setDesde] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ProductoElegible[]>([]);

  const [garantia, setGarantia] = useState("");
  const [diasNuevo, setDiasNuevo] = useState("30");

  function tomar(valores: Record<string, unknown>) {
    const elegido = valores.elegido_semana as ElegidoGuardado | null | undefined;
    setDatos(completar(elegido?.datos, 4));
    setRazones(completar(elegido?.razones, 3));
    setDesde(elegido?.desde ?? null);
    setGarantia(typeof valores.garantia_meses === "number" ? String(valores.garantia_meses) : "");
    setDiasNuevo(typeof valores.dias_nuevo === "number" ? String(valores.dias_nuevo) : "30");
    return elegido?.producto_id ?? null;
  }

  useEffect(() => {
    (async () => {
      const { data, error: errorConfig } = await supabase
        .from("tienda_configuracion")
        .select("clave, valor")
        .in("clave", ["elegido_semana", "garantia_meses", "dias_nuevo"]);
      if (errorConfig) throw new Error(errorConfig.message);
      const valores = Object.fromEntries(((data ?? []) as Array<{ clave: string; valor: unknown }>).map((f) => [f.clave, f.valor]));
      const id = tomar(valores);
      if (id) {
        const { data: fila } = await supabase.from("tienda_productos").select(COLUMNAS).eq("id", id).maybeSingle();
        setProducto((fila as ProductoElegible | null) ?? null);
      }
    })()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar la portada."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const termino = busqueda.trim();
    if (termino.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const espera = window.setTimeout(() => {
      supabase
        .from("tienda_productos")
        .select(COLUMNAS)
        .ilike("nombre", `%${termino.replace(/[%_]/g, "")}%`)
        .order("nombre")
        .limit(8)
        .then(({ data }) => {
          if (!cancelado) setResultados((data ?? []) as ProductoElegible[]);
        });
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [busqueda]);

  async function guardar(cambios: Record<string, unknown>, aviso: string) {
    setGuardando(true);
    try {
      const { data, error: errorRpc } = await supabase.rpc("panel_guardar_portada", { p_cambios: cambios });
      if (errorRpc) throw new Error(errorRpc.message);
      tomar((data ?? {}) as Record<string, unknown>);
      toast.success(aviso);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  function guardarElegido(evento: FormEvent) {
    evento.preventDefault();
    if (!producto) {
      toast.error("Elegí un producto.");
      return;
    }
    void guardar(
      {
        elegido_semana: {
          producto_id: producto.id,
          datos: datos.map((d) => d.trim()).filter(Boolean),
          razones: razones.map((r) => r.trim()).filter(Boolean),
        },
      },
      "Elegido de la semana guardado",
    );
  }

  function quitarElegido() {
    setProducto(null);
    void guardar({ elegido_semana: null }, "La portada ya no muestra el elegido de la semana");
  }

  function guardarFranja(evento: FormEvent) {
    evento.preventDefault();
    void guardar(
      {
        garantia_meses: garantia.trim() === "" ? null : Number(garantia),
        dias_nuevo: Number(diasNuevo),
      },
      "Franja de confianza y etiquetas guardadas",
    );
  }

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando la portada</p>;
  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <div className="grid max-w-4xl gap-4">
      <SurfaceCard className="space-y-4">
        <form onSubmit={guardarElegido} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Elegido de la semana</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Un producto con hasta cuatro datos clave y de una a tres razones de por qué lo elegimos. Sin elegido, la portada no muestra el bloque.
              {desde && ` Elegido el ${desde}.`}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Producto</span>
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscá por nombre entre los productos a la vista" />
            </label>
            {resultados.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                {resultados.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setProducto(r);
                        setBusqueda("");
                        setResultados([]);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-secondary"
                    >
                      <span>
                        {r.marca && <span className="text-muted-foreground">{r.marca} · </span>}
                        {r.nombre}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{r.precio_final_ars !== null ? formatearPesos(r.precio_final_ars) : "Sin precio"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {producto ? (
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
                <span className="font-bold">{producto.nombre}</span>
                {producto.precio_final_ars !== null && <span className="tabular-nums"> · {formatearPesos(producto.precio_final_ars)}</span>}
                {!producto.hay_stock && <span className="text-danger"> · sin stock</span>}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay producto elegido.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {datos.map((valor, i) => (
              <label key={`dato-${i}`} className="block space-y-1 text-sm">
                <span className="font-medium">Dato clave {i + 1}</span>
                <Input value={valor} maxLength={60} onChange={(e) => setDatos(datos.map((d, j) => (j === i ? e.target.value : d)))} />
              </label>
            ))}
          </div>

          <div className="grid gap-3">
            {razones.map((valor, i) => (
              <label key={`razon-${i}`} className="block space-y-1 text-sm">
                <span className="font-medium">Razón {i + 1}</span>
                <textarea value={valor} maxLength={180} onChange={(e) => setRazones(razones.map((r, j) => (j === i ? e.target.value : r)))} className={CLASE_TEXTAREA} />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={guardando || !producto}>
              Guardar el elegido
            </Button>
            <Button type="button" variant="outline" disabled={guardando} onClick={quitarElegido}>
              Quitar de la portada
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard>
        <form onSubmit={guardarFranja} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Franja de confianza y etiquetas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Los meses de garantía que promete la portada. Vacío: la franja muestra un marcador hasta que esté confirmado. Las cuotas salen de Dólar y margen.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Garantía en meses</span>
              <Input type="number" min={1} max={120} value={garantia} onChange={(e) => setGarantia(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Días con la etiqueta Nuevo</span>
              <Input type="number" min={0} max={365} value={diasNuevo} onChange={(e) => setDiasNuevo(e.target.value)} />
            </label>
          </div>
          <Button type="submit" disabled={guardando}>
            Guardar
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}
