import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import {
  categoriaDe,
  completarDescripcionesDeNewBytes,
  costoEnDolares,
  fotoDe,
  idsYaVinculados,
  importarDeNewBytes,
  stockDe,
  traerCatalogoDeNewBytes,
  type ProductoNewBytes,
} from "@/lib/api/newBytes";

const MOSTRAR = 120;
const formatoDolares = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Sync › New Bytes: el catálogo de New Bytes para elegir uno por uno qué entra a la tienda. Lo elegido
 * entra sin publicar (se publica desde Productos); lo que ya estaba vinculado aparece marcado.
 * Después, la sincronización automática de las 9 y las 18 les actualiza costo y stock.
 */
export function NewBytesImportar({ userId, alImportar }: { userId?: string; alImportar?: () => void }) {
  const [catalogo, setCatalogo] = useState<ProductoNewBytes[] | null>(null);
  const [vinculados, setVinculados] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [describiendo, setDescribiendo] = useState(false);

  async function completarDescripciones() {
    setDescribiendo(true);
    try {
      const r = await completarDescripcionesDeNewBytes();
      if (r.sin_descripcion === 0) toast.success("Todos los productos de New Bytes ya tienen descripción");
      else
        toast.success("Descripciones de New Bytes cargadas", {
          description: `${r.completadas} de ${r.sin_descripcion} productos sin descripción${r.sin_texto_en_new_bytes ? `; ${r.sin_texto_en_new_bytes} no tienen texto en New Bytes` : ""}.`,
        });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron traer las descripciones.");
    } finally {
      setDescribiendo(false);
    }
  }

  async function traer() {
    setCargando(true);
    setError(null);
    try {
      const [lista, ya] = await Promise.all([traerCatalogoDeNewBytes(), idsYaVinculados()]);
      setCatalogo(lista);
      setVinculados(ya);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo traer el catálogo de New Bytes.");
    } finally {
      setCargando(false);
    }
  }

  const categorias = useMemo(() => [...new Set((catalogo ?? []).map(categoriaDe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [catalogo]);

  const filtrados = useMemo(() => {
    const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
    return (catalogo ?? []).filter((p) => {
      if (soloConStock && stockDe(p) <= 0) return false;
      if (categoria && categoriaDe(p) !== categoria) return false;
      if (palabras.length === 0) return true;
      const donde = normalizar(`${p.title ?? ""} ${p.sku ?? ""} ${categoriaDe(p)}`);
      return palabras.every((palabra) => donde.includes(palabra));
    });
  }, [catalogo, busqueda, categoria, soloConStock]);

  function alternar(id: string) {
    setElegidos((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  const idsDeLaLista = useMemo(() => filtrados.map((p) => String(p.id)), [filtrados]);
  const todaLaListaElegida = idsDeLaLista.length > 0 && idsDeLaLista.every((id) => elegidos.has(id));
  const parteDeLaListaElegida = !todaLaListaElegida && idsDeLaLista.some((id) => elegidos.has(id));

  /** Elige (o suelta) todos los de la lista filtrada, también los que no entran en pantalla. Lo elegido de otras búsquedas queda. */
  function alternarLaLista() {
    setElegidos((previo) => {
      const nuevo = new Set(previo);
      for (const id of idsDeLaLista) {
        if (todaLaListaElegida) nuevo.delete(id);
        else nuevo.add(id);
      }
      return nuevo;
    });
  }

  async function importar() {
    const productos = (catalogo ?? []).filter((p) => elegidos.has(String(p.id)));
    if (productos.length === 0) return;
    setImportando(true);
    try {
      const resultado = await importarDeNewBytes(productos, userId);
      toast.success("Productos de New Bytes importados", {
        description: `${resultado.inserted} nuevos sin publicar, ${resultado.updated} que ya estaban${resultado.errors.length ? `, ${resultado.errors.length} con error` : ""}.`,
      });
      if (resultado.errors.length) console.error("[new-bytes] Errores al importar:", resultado.errors);
      setVinculados((previo) => new Set([...previo, ...productos.map((p) => String(p.id))]));
      setElegidos(new Set());
      alImportar?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron importar los productos.");
    } finally {
      setImportando(false);
    }
  }

  return (
    <SurfaceCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">New Bytes</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Despacha directo al cliente con Entregar. Elegí uno por uno qué productos entran: quedan sin publicar hasta que los publiques
            desde Productos. El envío de estos productos es la tarifa plana de Configuración › Envíos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={describiendo} onClick={completarDescripciones} title="Carga el texto de New Bytes en los productos que no tienen descripción">
            {describiendo ? "Trayendo descripciones" : "Completar descripciones"}
          </Button>
          <Button type="button" variant="outline" disabled={cargando} onClick={traer} className="gap-2">
            <Download className="h-4 w-4" aria-hidden />
            {catalogo ? "Volver a traer el catálogo" : cargando ? "Trayendo el catálogo" : "Traer el catálogo"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {catalogo && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o código" className="pl-9" />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="h-11 rounded-xl border border-input bg-card px-3 text-sm"
              aria-label="Categoría de New Bytes"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} />
              Solo con stock
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className={cn("flex items-center gap-2 text-sm font-medium", idsDeLaLista.length === 0 ? "opacity-50" : "cursor-pointer")}>
              <input
                type="checkbox"
                checked={todaLaListaElegida}
                ref={(el) => {
                  if (el) el.indeterminate = parteDeLaListaElegida;
                }}
                disabled={idsDeLaLista.length === 0}
                onChange={alternarLaLista}
              />
              {todaLaListaElegida ? `Soltar los ${idsDeLaLista.length} de la lista` : `Elegir los ${idsDeLaLista.length} de la lista`}
            </label>
            <p className="text-sm text-muted-foreground">
              {filtrados.length} de {catalogo.length} productos{filtrados.length > MOSTRAR ? `: se muestran los primeros ${MOSTRAR}` : ""}
              {elegidos.size > 0 ? ` · ${elegidos.size} elegidos en total` : ""}.
            </p>
          </div>

          <ul className="max-h-[520px] divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {filtrados.slice(0, MOSTRAR).map((p) => {
              const id = String(p.id);
              const yaEsta = vinculados.has(id);
              const elegido = elegidos.has(id);
              const foto = fotoDe(p);
              return (
                <li key={id}>
                  <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", elegido && "bg-secondary/70")}>
                    <input type="checkbox" checked={elegido} onChange={() => alternar(id)} aria-label={`Elegir ${p.title ?? id}`} />
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-placa-foto">
                      {foto ? <img src={foto} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" loading="lazy" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.title ?? id}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.sku ?? ""} · {categoriaDe(p) || "Sin categoría"}
                      </span>
                    </span>
                    {yaEsta && <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Ya está</span>}
                    <span className="w-20 text-right tabular-nums text-muted-foreground">{stockDe(p)} u.</span>
                    <span className="w-24 text-right tabular-nums">{formatoDolares.format(costoEnDolares(p))}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Costo en dólares sin IVA, como lo manda New Bytes.</p>
            <div className="flex gap-2">
              {elegidos.size > 0 && (
                <Button type="button" variant="ghost" onClick={() => setElegidos(new Set())} disabled={importando}>
                  Limpiar
                </Button>
              )}
              <Button type="button" disabled={elegidos.size === 0 || importando} onClick={importar}>
                {importando ? "Importando" : `Importar ${elegidos.size || ""} elegidos`.replace("  ", " ")}
              </Button>
            </div>
          </div>
        </>
      )}
    </SurfaceCard>
  );
}
