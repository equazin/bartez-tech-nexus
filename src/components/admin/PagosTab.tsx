import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cancelarPedido, listarPagos, reintegrarPago, validarTransferencia, type LineaDeDespachoDirecto, type PagoDelPanel, type PedidoDeLaTienda } from "@/lib/api/pagos";
import { DespachoDirecto } from "./DespachoDirecto";
import { EnviosZipnova } from "./EnviosZipnova";
import { FacturasTienda } from "./FacturasTienda";
import { useAuth } from "@/context/AuthContext";

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

const ESTADOS: Record<string, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  preparando: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  reintegrado: "Reintegrado",
  vencido: "Vencido",
};

const MEDIOS: Record<string, string> = { mercadopago: "Mercado Pago", mercadopago_cuotas: "Mercado Pago en 3 cuotas", transferencia: "Transferencia" };

function tonoDe(estado: string): "success" | "secondary" | "destructive" | "muted" {
  if (estado === "pagado" || estado === "entregado") return "success";
  if (estado === "cancelado" || estado === "vencido") return "muted";
  if (estado === "reintegrado") return "destructive";
  return "secondary";
}

/** Ventas › Pagos: los pedidos de la tienda con sus pagos, lo que despacha un mayorista directo y las acciones que cambian plata. */
export function PagosTab() {
  const { isAdmin } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoDeLaTienda[]>([]);
  const [pagos, setPagos] = useState<PagoDelPanel[]>([]);
  const [despachos, setDespachos] = useState<LineaDeDespachoDirecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [trabajando, setTrabajando] = useState<number | null>(null);
  const [reintegro, setReintegro] = useState<{ pago: PagoDelPanel; monto: string; motivo: string } | null>(null);

  async function recargar() {
    const datos = await listarPagos();
    setPedidos(datos.pedidos);
    setPagos(datos.pagos);
    setDespachos(datos.despachos ?? []);
  }

  useEffect(() => {
    recargar()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar los pagos."))
      .finally(() => setCargando(false));
  }, []);

  const pagosPorPedido = useMemo(() => {
    const mapa = new Map<number, PagoDelPanel[]>();
    for (const pago of pagos) mapa.set(pago.order_id, [...(mapa.get(pago.order_id) ?? []), pago]);
    return mapa;
  }, [pagos]);

  const despachosPorPedido = useMemo(() => {
    const mapa = new Map<number, LineaDeDespachoDirecto[]>();
    for (const linea of despachos) mapa.set(linea.order_id, [...(mapa.get(linea.order_id) ?? []), linea]);
    return mapa;
  }, [despachos]);

  const visibles = pedidos.filter((p) => {
    if (filtro !== "todos" && p.status !== filtro) return false;
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return true;
    return [p.order_number, p.comprador_nombre, p.comprador_email].some((v) => (v ?? "").toLowerCase().includes(texto));
  });

  async function accion(id: number, tarea: () => Promise<unknown>, exito: string) {
    setTrabajando(id);
    try {
      await tarea();
      await recargar();
      toast.success(exito);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setTrabajando(null);
    }
  }

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando los pagos</p>;
  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <div className="max-w-6xl space-y-4">
      <EnviosZipnova />
      <FacturasTienda />
      <div className="flex flex-wrap items-center gap-2">
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por número, nombre o email" className="max-w-xs" />
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-11 rounded-xl border border-input bg-card px-3 text-sm"
          aria-label="Estado"
        >
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">{visibles.length} pedidos</span>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay pedidos de la tienda con ese filtro.</p>
      ) : (
        <ul className="space-y-3">
          {visibles.map((pedido) => {
            const suyos = pagosPorPedido.get(pedido.id) ?? [];
            const aprobado = suyos.find((p) => p.estado === "aprobado");
            const ocupado = trabajando === pedido.id;
            return (
              <li key={pedido.id}>
                <SurfaceCard padding="sm" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-bold">
                        {pedido.order_number} · <span className="tabular-nums">{formatoPesos.format(pedido.total)}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {pedido.comprador_nombre ?? "Sin nombre"} · {pedido.comprador_email ?? ""} · {formatoFecha.format(new Date(pedido.created_at))} ·{" "}
                        {MEDIOS[pedido.payment_method ?? ""] ?? pedido.payment_method ?? "Sin medio"}
                      </p>
                    </div>
                    <Badge variant={tonoDe(pedido.status)}>{ESTADOS[pedido.status] ?? pedido.status}</Badge>
                  </div>

                  {suyos.length > 0 && (
                    <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                      {suyos.map((pago) => (
                        <li key={pago.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span>
                            {MEDIOS[pago.proveedor]} · {pago.estado} · <span className="tabular-nums">{formatoPesos.format(pago.monto)}</span>
                            {pago.cuotas ? ` · ${pago.cuotas} cuotas` : ""}
                            {pago.id_externo ? ` · pago ${pago.id_externo}` : ""}
                            {Number(pago.reintegrado_monto) > 0 ? ` · reintegrado ${formatoPesos.format(pago.reintegrado_monto)}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatoFecha.format(new Date(pago.aprobado_en ?? pago.creado_en))}
                            {pago.nota ? ` · ${pago.nota}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <DespachoDirecto pedido={pedido} lineas={despachosPorPedido.get(pedido.id) ?? []} />

                  {pedido.notes && <p className="text-sm text-muted-foreground">{pedido.notes}</p>}

                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      {pedido.payment_method === "transferencia" && (pedido.status === "pendiente_pago" || pedido.status === "vencido") && (
                        <Button size="sm" disabled={ocupado} onClick={() => accion(pedido.id, () => validarTransferencia(pedido.id), "Transferencia confirmada: el pedido quedó pagado")}>
                          Confirmar transferencia
                        </Button>
                      )}
                      {pedido.status === "pendiente_pago" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={ocupado}
                          onClick={() => accion(pedido.id, () => cancelarPedido(pedido.id, "Cancelado desde el panel."), "Pedido cancelado y stock liberado")}
                        >
                          Cancelar pedido
                        </Button>
                      )}
                      {aprobado && (
                        <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setReintegro({ pago: aprobado, monto: "", motivo: "" })}>
                          Reintegrar
                        </Button>
                      )}
                    </div>
                  )}

                  {reintegro && reintegro.pago.order_id === pedido.id && (
                    <form
                      className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_2fr_auto_auto]"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const monto = reintegro.monto.trim() === "" ? null : Number(reintegro.monto.replace(",", "."));
                        void accion(pedido.id, () => reintegrarPago(reintegro.pago.id, monto, reintegro.motivo), "Reintegro hecho").then(() => setReintegro(null));
                      }}
                    >
                      <Input inputMode="decimal" placeholder="Monto (vacío: todo)" value={reintegro.monto} onChange={(e) => setReintegro({ ...reintegro, monto: e.target.value })} />
                      <Input placeholder="Motivo" value={reintegro.motivo} onChange={(e) => setReintegro({ ...reintegro, motivo: e.target.value })} />
                      <Button type="submit" size="sm" disabled={ocupado}>
                        {reintegro.pago.proveedor === "mercadopago" ? "Reintegrar en Mercado Pago" : "Anotar reintegro"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setReintegro(null)}>
                        Cerrar
                      </Button>
                    </form>
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
