import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { guardarCuponDeCompra, leerCuponDeCompra, type ConfiguracionDelCupon, type EstadoDelCupon } from "@/lib/api/cuentaPanel";

const CLASE_SELECT = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm";

const POR_DEFECTO: ConfiguracionDelCupon = {
  activo: false,
  tipo: "percentage",
  valor: 0,
  minimo: 0,
  tope: null,
  dias: 60,
  categorias: [],
  solo_primera: true,
};

/**
 * Marketing › Cupones › Cupón para la próxima compra: se genera solo cuando una compra pasa a entregada, viaja en
 * el email de entrega y en la página de la compra, y se activa en Mi cuenta con el email de esa compra. Es de un
 * uso y solo vale con la sesión abierta de la cuenta que lo activó.
 */
export function CuponDeCompra() {
  const [estado, setEstado] = useState<EstadoDelCupon | null>(null);
  const [c, setC] = useState<ConfiguracionDelCupon>(POR_DEFECTO);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargar(datos: EstadoDelCupon) {
    setEstado(datos);
    setC({ ...POR_DEFECTO, ...(datos.cupon ?? {}) });
  }

  useEffect(() => {
    leerCuponDeCompra()
      .then(cargar)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer el cupón."));
  }, []);

  const nombreDe = useMemo(() => new Map((estado?.categorias ?? []).map((cat) => [cat.id, cat.name])), [estado]);

  async function guardar() {
    setGuardando(true);
    try {
      cargar(await guardarCuponDeCompra(c));
      toast.success(c.activo ? "Cupón activo: sale con cada compra entregada." : "Cupón guardado (apagado).");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el cupón.");
    } finally {
      setGuardando(false);
    }
  }

  if (error) return <SurfaceCard className="text-sm text-danger">{error}</SurfaceCard>;
  if (!estado) return <SurfaceCard className="text-sm text-muted-foreground">Cargando el cupón para la próxima compra</SurfaceCard>;

  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Cupón para la próxima compra</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando una compra de la tienda pasa a entregada, se genera un código único para ese cliente. Le llega en el email de entrega y lo activa en
          Mi cuenta con el mismo email; después lo usa una vez, con la sesión abierta. Si la compra con el cupón vence sin pagarse, el cupón vuelve a
          quedar disponible.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Emitidos: {estado.resumen.emitidos} · Activados: {estado.resumen.activados} · Usados: {estado.resumen.usados}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={c.activo} onChange={(e) => setC({ ...c, activo: e.target.checked })} />
          Generar el cupón con cada compra entregada
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.solo_primera} onChange={(e) => setC({ ...c, solo_primera: e.target.checked })} />
          Solo con la primera compra de cada email
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo de descuento</span>
          <select className={CLASE_SELECT} value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value as ConfiguracionDelCupon["tipo"] })}>
            <option value="percentage">Porcentaje</option>
            <option value="fixed">Monto fijo en pesos</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{c.tipo === "percentage" ? "Porcentaje (%)" : "Monto (pesos)"}</span>
          <Input type="number" min={0} max={c.tipo === "percentage" ? 90 : undefined} step={c.tipo === "percentage" ? "0.5" : "100"} value={c.valor} onChange={(e) => setC({ ...c, valor: Number(e.target.value) || 0 })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Compra mínima (pesos, 0 sin mínimo)</span>
          <Input type="number" min={0} step="1000" value={c.minimo} onChange={(e) => setC({ ...c, minimo: Number(e.target.value) || 0 })} />
        </label>
        {c.tipo === "percentage" && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">Descuento máximo (pesos, vacío sin tope)</span>
            <Input type="number" min={0} step="1000" value={c.tope ?? ""} onChange={(e) => setC({ ...c, tope: e.target.value ? Number(e.target.value) : null })} />
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="font-medium">Días para usarlo</span>
          <Input type="number" min={1} max={365} value={c.dias} onChange={(e) => setC({ ...c, dias: Math.min(Math.max(Number(e.target.value) || 1, 1), 365) })} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Categorías (vacío: vale para toda la tienda)</p>
        <div className="flex flex-wrap gap-2">
          {c.categorias.map((id) => (
            <button
              key={id}
              type="button"
              className="rounded-chip border border-input px-3 py-1 text-xs hover:bg-secondary"
              onClick={() => setC({ ...c, categorias: c.categorias.filter((x) => x !== id) })}
              title="Quitar"
            >
              {nombreDe.get(id) ?? `Categoría ${id}`} ×
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={`${CLASE_SELECT} max-w-xs`} value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)}>
            <option value="">Sumar una categoría</option>
            {estado.categorias
              .filter((cat) => !c.categorias.includes(cat.id))
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parent_id ? `· ${cat.name}` : cat.name}
                </option>
              ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={!nuevaCategoria}
            onClick={() => {
              setC({ ...c, categorias: [...c.categorias, Number(nuevaCategoria)] });
              setNuevaCategoria("");
            }}
          >
            Sumar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Una categoría incluye sus subcategorías. El descuento se calcula solo sobre esos productos.</p>
      </div>

      <Button type="button" onClick={() => void guardar()} disabled={guardando}>
        {guardando ? "Guardando" : "Guardar el cupón"}
      </Button>
    </SurfaceCard>
  );
}
