import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  ajustarPuntos,
  borrarEventoDePuntos,
  cambiarEventoDePuntos,
  crearEventoDePuntos,
  guardarReglasDePuntos,
  leerPanelDePuntos,
  listarCategoriasDelPanel,
  listarEventosDePuntos,
  puntosDeCliente,
  type CategoriaDelPanel,
  type EventoDelPanel,
  type PuntosDeCliente,
  type ReglasDePuntos,
  type ResumenDePuntos,
} from "@/lib/api/puntosPanel";
import { formatearPuntos } from "@/lib/tienda/puntos";

const CLASE_SELECT = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm";
const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" });

const POR_DEFECTO: ReglasDePuntos = {
  activo: false,
  pesos_por_punto: 1000,
  valor_del_punto: 10,
  dias_de_espera: 10,
  meses_de_vencimiento: 12,
  minimo_para_canjear: 100,
  tope_porcentaje: 30,
  dias_del_cupon: 60,
  bono_cuenta: 0,
  bono_datos: 0,
  bono_primera_compra: 0,
};

const CAMPOS: Array<{ clave: keyof Omit<ReglasDePuntos, "activo">; etiqueta: string; ayuda?: string; paso?: string }> = [
  { clave: "pesos_por_punto", etiqueta: "Pesos pagados por cada punto", ayuda: "Sobre lo pagado en productos, sin el envío.", paso: "100" },
  { clave: "valor_del_punto", etiqueta: "Valor de cada punto al canjear (pesos)", paso: "1" },
  { clave: "dias_de_espera", etiqueta: "Días desde la entrega hasta liberarlos", ayuda: "10 = plazo de arrepentimiento." },
  { clave: "meses_de_vencimiento", etiqueta: "Meses hasta que vencen" },
  { clave: "minimo_para_canjear", etiqueta: "Canje mínimo (puntos)" },
  { clave: "tope_porcentaje", etiqueta: "Tope del cupón (% de la compra)" },
  { clave: "dias_del_cupon", etiqueta: "Días para usar el cupón del canje", ayuda: "Si vence sin usarse, los puntos vuelven." },
  { clave: "bono_cuenta", etiqueta: "Bono por crear la cuenta (puntos)", ayuda: "0 = sin bono." },
  { clave: "bono_datos", etiqueta: "Bono por completar Mis datos (puntos)", ayuda: "0 = sin bono." },
  { clave: "bono_primera_compra", etiqueta: "Bono por la primera compra (puntos)", ayuda: "0 = sin bono." },
];

const TIPOS: Record<string, string> = {
  compra: "Compra",
  bono: "Bono",
  canje: "Canje",
  devolucion: "Devolución",
  reverso: "Anulación",
  vencimiento: "Vencimiento",
  ajuste: "Ajuste",
};

function Reglas({ inicial, alGuardar }: { inicial: ReglasDePuntos; alGuardar: (r: ReglasDePuntos) => void }) {
  const [r, setR] = useState<ReglasDePuntos>(inicial);
  const [guardando, setGuardando] = useState(false);
  const vuelve = r.pesos_por_punto > 0 ? (r.valor_del_punto / r.pesos_por_punto) * 100 : 0;

  async function guardar() {
    setGuardando(true);
    try {
      const guardadas = await guardarReglasDePuntos(r);
      setR({ ...POR_DEFECTO, ...guardadas });
      alGuardar(guardadas);
      toast.success(guardadas.activo ? "Reglas guardadas: el programa está activo." : "Reglas guardadas (programa apagado).");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar las reglas.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Reglas</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Con estos valores vuelve el <strong>{vuelve.toLocaleString("es-AR", { maximumFractionDigits: 2 })} %</strong> de lo pagado en productos. Sale de la
          ganancia: hoy anda en 7 % neto con transferencia.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={r.activo} onChange={(e) => setR({ ...r, activo: e.target.checked })} />
        Programa activo (suma puntos en las compras entregadas y deja canjear)
      </label>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CAMPOS.map((c) => (
          <label key={c.clave} className="space-y-1 text-sm">
            <span className="font-medium">{c.etiqueta}</span>
            <Input type="number" min={0} step={c.paso ?? "1"} value={r[c.clave]} onChange={(e) => setR({ ...r, [c.clave]: Number(e.target.value) || 0 })} />
            {c.ayuda && <span className="block text-xs text-muted-foreground">{c.ayuda}</span>}
          </label>
        ))}
      </div>
      <Button onClick={() => void guardar()} disabled={guardando}>
        {guardando ? "Guardando" : "Guardar reglas"}
      </Button>
    </SurfaceCard>
  );
}

function Eventos({ categorias }: { categorias: CategoriaDelPanel[] }) {
  const [eventos, setEventos] = useState<EventoDelPanel[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [multiplicador, setMultiplicador] = useState(2);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [guardando, setGuardando] = useState(false);
  const nombreDe = useMemo(() => new Map(categorias.map((c) => [c.id, c.name])), [categorias]);

  async function cargar() {
    try {
      setEventos(await listarEventosDePuntos());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron leer los eventos.");
      setEventos([]);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    if (!nombre.trim() || !desde || !hasta) {
      toast.error("Completá el nombre y las fechas.");
      return;
    }
    if (hasta < desde) {
      toast.error("La fecha de fin tiene que ser posterior a la de inicio.");
      return;
    }
    setGuardando(true);
    try {
      // Las fechas son días completos de Argentina.
      await crearEventoDePuntos({
        nombre: nombre.trim(),
        multiplicador,
        desde: `${desde}T00:00:00-03:00`,
        hasta: `${hasta}T23:59:59-03:00`,
        categorias: elegidas,
        activo: true,
      });
      setNombre("");
      setDesde("");
      setHasta("");
      setElegidas([]);
      toast.success("Evento creado.");
      await cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el evento.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(e: EventoDelPanel) {
    try {
      await cambiarEventoDePuntos(e.id, { activo: !e.activo });
      await cargar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el evento.");
    }
  }

  async function borrar(e: EventoDelPanel) {
    if (!window.confirm(`¿Borrar el evento "${e.nombre}"? Las compras que ya sumaron puntos no cambian.`)) return;
    try {
      await borrarEventoDePuntos(e.id);
      await cargar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el evento.");
    }
  }

  const ahora = new Date();
  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Eventos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Multiplican los puntos de las compras hechas entre esas fechas, en toda la tienda o solo en algunas categorías. Si dos eventos coinciden, vale el
          más alto.
        </p>
      </div>

      {eventos === null ? (
        <p className="text-sm text-muted-foreground">Cargando los eventos</p>
      ) : eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay eventos.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {eventos.map((e) => {
            const vigente = e.activo && new Date(e.desde) <= ahora && new Date(e.hasta) > ahora;
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {e.nombre} · x{e.multiplicador}
                    {vigente && <span className="ml-2 rounded-chip bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Vigente</span>}
                    {!e.activo && <span className="ml-2 rounded-chip bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Apagado</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fecha.format(new Date(e.desde))} al {fecha.format(new Date(e.hasta))} ·{" "}
                    {e.categorias && e.categorias.length > 0 ? e.categorias.map((id) => nombreDe.get(id) ?? `Categoría ${id}`).join(", ") : "Toda la tienda"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void alternar(e)}>
                    {e.activo ? "Apagar" : "Prender"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void borrar(e)}>
                    Borrar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={crear} className="space-y-3 rounded-xl border border-dashed border-border p-4">
        <p className="text-sm font-bold">Nuevo evento</p>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">Nombre</span>
            <Input value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Semana de notebooks" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Multiplicador</span>
            <select className={CLASE_SELECT} value={multiplicador} onChange={(e) => setMultiplicador(Number(e.target.value))}>
              {[1.5, 2, 3, 4, 5].map((m) => (
                <option key={m} value={m}>
                  x{m}
                </option>
              ))}
            </select>
          </label>
          <div />
          <label className="space-y-1 text-sm">
            <span className="font-medium">Desde</span>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Hasta</span>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Categorías (vacío: toda la tienda)</p>
          <div className="flex flex-wrap gap-2">
            {elegidas.map((id) => (
              <button
                key={id}
                type="button"
                className="rounded-chip border border-input px-3 py-1 text-xs hover:bg-secondary"
                onClick={() => setElegidas(elegidas.filter((x) => x !== id))}
                title="Quitar"
              >
                {nombreDe.get(id) ?? `Categoría ${id}`} ×
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select className={`${CLASE_SELECT} max-w-xs`} value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)}>
              <option value="">Sumar una categoría</option>
              {categorias
                .filter((c) => !elegidas.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `· ${c.name}` : c.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={!nuevaCategoria}
              onClick={() => {
                setElegidas([...elegidas, Number(nuevaCategoria)]);
                setNuevaCategoria("");
              }}
            >
              Sumar
            </Button>
          </div>
        </div>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Creando" : "Crear evento"}
        </Button>
      </form>
    </SurfaceCard>
  );
}

function Clientes() {
  const [email, setEmail] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState<PuntosDeCliente | null>(null);
  const [ajuste, setAjuste] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ajustando, setAjustando] = useState(false);

  async function buscar(evento: FormEvent) {
    evento.preventDefault();
    if (!email.trim()) return;
    setBuscando(true);
    try {
      setCliente(await puntosDeCliente(email));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo buscar.");
    } finally {
      setBuscando(false);
    }
  }

  async function ajustar(evento: FormEvent) {
    evento.preventDefault();
    if (!cliente) return;
    const puntos = Number.parseInt(ajuste, 10);
    if (!puntos) {
      toast.error("Indicá cuántos puntos sumar (positivo) o restar (negativo).");
      return;
    }
    setAjustando(true);
    try {
      setCliente(await ajustarPuntos(cliente.email, puntos, motivo));
      setAjuste("");
      setMotivo("");
      toast.success("Ajuste cargado.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar el ajuste.");
    } finally {
      setAjustando(false);
    }
  }

  return (
    <SurfaceCard className="space-y-4">
      <div>
        <h3 className="text-base font-bold">Clientes</h3>
        <p className="mt-1 text-sm text-muted-foreground">Buscá por email para ver el saldo y los movimientos, y cargar un ajuste con su motivo.</p>
      </div>
      <form onSubmit={buscar} className="flex flex-wrap gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cliente.com" className="max-w-sm" />
        <Button type="submit" disabled={buscando}>
          {buscando ? "Buscando" : "Buscar"}
        </Button>
      </form>

      {cliente && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Disponibles", cliente.saldo.disponibles],
              ["Pendientes", cliente.saldo.pendientes],
              ["Vencen en 30 días", cliente.saldo.por_vencer],
            ].map(([titulo, valor]) => (
              <div key={titulo as string} className="rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{titulo}</p>
                <p className="text-2xl font-bold tabular-nums">{formatearPuntos(Number(valor))}</p>
              </div>
            ))}
          </div>

          {cliente.movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{cliente.email} no tiene movimientos.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Detalle</th>
                    <th className="px-3 py-2">Libera / vence</th>
                    <th className="px-3 py-2 text-right">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cliente.movimientos.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-3 py-2">{fecha.format(new Date(m.fecha))}</td>
                      <td className="px-3 py-2">{TIPOS[m.tipo] ?? m.tipo}</td>
                      <td className="px-3 py-2">
                        {m.detalle}
                        {m.cupon ? ` · ${m.cupon}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {m.puntos > 0 ? `${fecha.format(new Date(m.disponible_desde))}${m.vence_en ? ` / ${fecha.format(new Date(m.vence_en))}` : ""}` : ""}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold tabular-nums ${m.puntos > 0 ? "text-success" : ""}`}>
                        {m.puntos > 0 ? "+" : "−"}
                        {formatearPuntos(Math.abs(m.puntos))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={ajustar} className="grid gap-3 rounded-xl border border-dashed border-border p-4 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-end">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Puntos (+ o −)</span>
              <Input value={ajuste} onChange={(e) => setAjuste(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))} placeholder="Ej.: 500 o -200" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Motivo</span>
              <Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: compensación por demora del envío" />
            </label>
            <Button type="submit" disabled={ajustando}>
              {ajustando ? "Cargando" : "Cargar ajuste"}
            </Button>
          </form>
        </div>
      )}
    </SurfaceCard>
  );
}

/** Marketing › Puntos: reglas del programa, eventos con multiplicador y consulta de clientes. */
export function ProgramaDePuntos() {
  const [reglas, setReglas] = useState<ReglasDePuntos | null>(null);
  const [resumen, setResumen] = useState<ResumenDePuntos | null>(null);
  const [categorias, setCategorias] = useState<CategoriaDelPanel[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leerPanelDePuntos()
      .then(({ reglas: r, resumen: s }) => {
        setReglas({ ...POR_DEFECTO, ...(r ?? {}) });
        setResumen(s);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer el programa de puntos."));
    listarCategoriasDelPanel()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  if (error) return <SurfaceCard className="text-sm text-danger">{error}</SurfaceCard>;
  if (!reglas || !resumen) return <SurfaceCard className="text-sm text-muted-foreground">Cargando el programa de puntos</SurfaceCard>;

  return (
    <div className="space-y-4">
      <SurfaceCard className="space-y-3">
        <div>
          <h2 className="text-lg font-bold">Puntos Teqo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Los puntos se suman cuando una compra pasa a entregada, se liberan después del plazo de arrepentimiento y se canjean en Mi cuenta por un cupón
            personal. Si la compra se cancela o se reintegra, se anulan solos.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Clientes con puntos", formatearPuntos(resumen.clientes)],
            ["Puntos sumados", formatearPuntos(resumen.emitidos - resumen.anulados)],
            ["Canjeados", formatearPuntos(resumen.canjeados)],
            ["Vencidos", formatearPuntos(resumen.vencidos)],
            ["Saldo sin canjear", `${formatearPuntos(resumen.saldo)} (${pesos(resumen.saldo_en_pesos)})`],
          ].map(([titulo, valor]) => (
            <div key={titulo} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">{titulo}</p>
              <p className="text-lg font-bold tabular-nums">{valor}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">El saldo sin canjear incluye los pendientes: es lo que la tienda debe en descuentos si todos canjean.</p>
      </SurfaceCard>
      <Reglas inicial={reglas} alGuardar={(r) => setReglas({ ...POR_DEFECTO, ...r })} />
      <Eventos categorias={categorias} />
      <Clientes />
    </div>
  );
}
