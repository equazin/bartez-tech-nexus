import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { listarArrepentimientos, responderArrepentimiento, type Arrepentimiento } from "@/lib/api/legal";
import { useAuth } from "@/context/AuthContext";

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const ESTADOS: Array<{ valor: Arrepentimiento["estado"]; etiqueta: string }> = [
  { valor: "recibido", etiqueta: "Recibido" },
  { valor: "en_proceso", etiqueta: "En proceso" },
  { valor: "cerrado", etiqueta: "Cerrado" },
  { valor: "rechazado", etiqueta: "Rechazado" },
];
const HORAS_PARA_RESPONDER = 24;

function horasSinResponder(a: Arrepentimiento): number | null {
  if (a.respondido_en || a.estado !== "recibido") return null;
  return (Date.now() - new Date(a.creado_en).getTime()) / 3_600_000;
}

/** Legal › Arrepentimientos: la lista con el plazo de 24 horas para responder resaltado. */
export function ArrepentimientosTab() {
  const { isAdmin } = useAuth();
  const [lista, setLista] = useState<Arrepentimiento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("abiertos");
  const [edicion, setEdicion] = useState<Record<number, { estado: Arrepentimiento["estado"]; nota: string }>>({});

  useEffect(() => {
    listarArrepentimientos()
      .then(setLista)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar los arrepentimientos."))
      .finally(() => setCargando(false));
  }, []);

  const visibles = lista.filter((a) => (filtro === "abiertos" ? a.estado === "recibido" || a.estado === "en_proceso" : filtro === "todos" ? true : a.estado === filtro));

  async function guardar(a: Arrepentimiento) {
    const cambio = edicion[a.id] ?? { estado: a.estado, nota: a.nota_interna ?? "" };
    try {
      const actualizado = await responderArrepentimiento(a.id, cambio.estado, cambio.nota);
      setLista((previa) => previa.map((x) => (x.id === a.id ? actualizado : x)));
      toast.success("Arrepentimiento actualizado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando los arrepentimientos</p>;
  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="h-11 rounded-xl border border-input bg-card px-3 text-sm" aria-label="Estado">
          <option value="abiertos">Abiertos</option>
          <option value="todos">Todos</option>
          {ESTADOS.map((e) => (
            <option key={e.valor} value={e.valor}>
              {e.etiqueta}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{visibles.length} arrepentimientos. Hay 24 horas para responder cada uno.</span>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay arrepentimientos con ese filtro.</p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((a) => {
            const horas = horasSinResponder(a);
            const vencido = horas !== null && horas > HORAS_PARA_RESPONDER;
            const cambio = edicion[a.id] ?? { estado: a.estado, nota: a.nota_interna ?? "" };
            return (
              <li key={a.id}>
                <SurfaceCard padding="sm" className={`space-y-3 ${vencido ? "border-danger" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-bold">
                        {a.codigo}
                        {a.numero_pedido ? ` · compra ${a.numero_pedido}` : " · sin número de compra"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {a.nombre ?? "Sin nombre"} · {a.email} · {formatoFecha.format(new Date(a.creado_en))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {horas !== null && (
                        <span className={`text-xs font-bold ${vencido ? "text-danger" : "text-foreground"}`}>
                          {vencido ? `Sin respuesta hace ${Math.floor(horas)} h: pasó el plazo` : `Quedan ${Math.max(0, Math.ceil(HORAS_PARA_RESPONDER - horas))} h para responder`}
                        </span>
                      )}
                      <Badge variant={a.estado === "cerrado" ? "success" : a.estado === "rechazado" ? "muted" : "secondary"}>{ESTADOS.find((e) => e.valor === a.estado)?.etiqueta ?? a.estado}</Badge>
                    </div>
                  </div>
                  {a.motivo && <p className="text-sm">{a.motivo}</p>}
                  {isAdmin && (
                    <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                      <select
                        value={cambio.estado}
                        onChange={(e) => setEdicion({ ...edicion, [a.id]: { ...cambio, estado: e.target.value as Arrepentimiento["estado"] } })}
                        className="h-11 rounded-xl border border-input bg-card px-3 text-sm"
                        aria-label="Estado nuevo"
                      >
                        {ESTADOS.map((e) => (
                          <option key={e.valor} value={e.valor}>
                            {e.etiqueta}
                          </option>
                        ))}
                      </select>
                      <Input value={cambio.nota} onChange={(e) => setEdicion({ ...edicion, [a.id]: { ...cambio, nota: e.target.value } })} placeholder="Nota interna: qué se respondió, reintegro, devolución" />
                      <Button size="sm" onClick={() => guardar(a)}>
                        Guardar
                      </Button>
                    </div>
                  )}
                </SurfaceCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
