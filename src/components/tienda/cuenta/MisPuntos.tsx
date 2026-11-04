import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatearPesos } from "@/lib/tienda/dinero";
import { canjearPuntos, formatearPuntos, misPuntos, type CuponDeCanje, type MisPuntos as Datos, type MovimientoDePuntos } from "@/lib/tienda/puntos";
import { cn } from "@/lib/utils";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });
const fechaCorta = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const NOMBRES: Record<MovimientoDePuntos["tipo"], string> = {
  compra: "Compra",
  bono: "Bono",
  canje: "Canje",
  devolucion: "Devolución",
  reverso: "Anulación",
  vencimiento: "Vencimiento",
  ajuste: "Ajuste",
};

function Cifra({ titulo, valor, detalle, destacada = false }: { titulo: string; valor: number; detalle?: string | null; destacada?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border p-5", destacada ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>
      <span className={cn("text-xs font-semibold", destacada ? "text-background/75" : "text-muted-foreground")}>{titulo}</span>
      <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums">{formatearPuntos(Math.max(valor, 0))}</span>
      {detalle && <span className={cn("text-[13px]", destacada ? "text-background/80" : "text-muted-foreground")}>{detalle}</span>}
    </div>
  );
}

/** Mi cuenta › Puntos: saldo, canje por un cupón personal y el historial. */
export function MisPuntos({ alVerCupones }: { alVerCupones: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [canjeando, setCanjeando] = useState(false);
  const [cupon, setCupon] = useState<CuponDeCanje | null>(null);
  const [errorDelCanje, setErrorDelCanje] = useState<string | null>(null);

  async function cargar() {
    try {
      const nuevos = await misPuntos();
      setDatos(nuevos);
      setCantidad(String(Math.max(nuevos.saldo.disponibles, 0)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No pudimos cargar tus puntos.");
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  if (error) return <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>;
  if (!datos) return <p className="text-muted-foreground">Cargando tus puntos</p>;

  const { programa, saldo, movimientos } = datos;
  const pedidos = Number.parseInt(cantidad, 10) || 0;
  const valor = pedidos * programa.valor_del_punto;
  const minimoDeCompra = Math.ceil((valor * 100) / programa.tope_porcentaje);
  const alcanza = saldo.disponibles >= programa.minimo_para_canjear;

  async function canjear(evento: FormEvent) {
    evento.preventDefault();
    setErrorDelCanje(null);
    if (pedidos < programa.minimo_para_canjear) {
      setErrorDelCanje(`El canje mínimo es de ${formatearPuntos(programa.minimo_para_canjear)} puntos.`);
      return;
    }
    if (pedidos > saldo.disponibles) {
      setErrorDelCanje(`Tenés ${formatearPuntos(Math.max(saldo.disponibles, 0))} puntos disponibles.`);
      return;
    }
    setCanjeando(true);
    try {
      setCupon(await canjearPuntos(pedidos));
      await cargar();
    } catch (e: unknown) {
      setErrorDelCanje(e instanceof Error ? e.message : "No pudimos hacer el canje.");
    } finally {
      setCanjeando(false);
    }
  }

  return (
    <div className="space-y-6">
      {!programa.activo && <p className="rounded-xl bg-secondary p-4 text-sm">Por ahora el programa de puntos no está activo. Tus movimientos siguen acá.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Cifra
          titulo="Puntos disponibles"
          valor={saldo.disponibles}
          detalle={programa.valor_del_punto > 0 ? `Equivalen a ${formatearPesos(Math.max(saldo.disponibles, 0) * programa.valor_del_punto)}` : null}
          destacada
        />
        <Cifra
          titulo="Pendientes"
          valor={saldo.pendientes}
          detalle={saldo.proxima_liberacion ? `Se liberan desde el ${fecha.format(new Date(saldo.proxima_liberacion))}` : "Se liberan después del plazo de arrepentimiento"}
        />
        <Cifra
          titulo="Vencen en los próximos 30 días"
          valor={saldo.por_vencer}
          detalle={saldo.proximo_vencimiento ? `El próximo vencimiento es el ${fecha.format(new Date(saldo.proximo_vencimiento))}` : null}
        />
      </div>

      {programa.activo && (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Canjear puntos</h2>
            <p className="text-sm text-muted-foreground">
              Cada punto vale {formatearPesos(programa.valor_del_punto)}. El canje te da un cupón de descuento ya activo en tu cuenta, para usar al finalizar la
              compra con la sesión abierta.
            </p>
          </div>
          {cupon ? (
            <div className="space-y-3 rounded-xl bg-exito-fondo p-4">
              <p className="text-sm">Listo, canjeaste {formatearPuntos(cupon.puntos)} puntos.</p>
              <p className="font-mono text-2xl font-bold tracking-[0.12em]">{cupon.codigo}</p>
              <p className="text-sm">
                {formatearPesos(cupon.valor)} de descuento en compras desde {formatearPesos(cupon.minimo)}. Vence el {fecha.format(new Date(cupon.vence_en))}; si no
                lo usás, los puntos vuelven a tu cuenta.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={alVerCupones}>
                  Ver mis cupones
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCupon(null)}>
                  Hacer otro canje
                </Button>
              </div>
            </div>
          ) : alcanza ? (
            <form onSubmit={canjear} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="block flex-1 space-y-1 text-sm">
                <span className="font-medium">Puntos a canjear</span>
                <Input inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, "").slice(0, 9))} className="tabular-nums" />
                <span className="block text-xs text-muted-foreground">
                  {pedidos > 0
                    ? `Cupón de ${formatearPesos(valor)} para compras desde ${formatearPesos(minimoDeCompra)}.`
                    : `Mínimo ${formatearPuntos(programa.minimo_para_canjear)} puntos.`}
                </span>
              </label>
              <Button type="submit" size="lg" disabled={canjeando}>
                {canjeando ? "Canjeando" : "Canjear por un cupón"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Podés canjear desde {formatearPuntos(programa.minimo_para_canjear)} puntos. Te faltan{" "}
              {formatearPuntos(programa.minimo_para_canjear - Math.max(saldo.disponibles, 0))}.
            </p>
          )}
          {errorDelCanje && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{errorDelCanje}</p>}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tenés movimientos. Los puntos aparecen cuando te entregamos una compra.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {movimientos.map((m) => {
              const pendiente = (m.tipo === "compra" || m.tipo === "bono") && new Date(m.disponible_desde) > new Date();
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">
                      {NOMBRES[m.tipo]}
                      {m.compra ? ` · ${m.compra}` : ""}
                      {m.cupon ? ` · ${m.cupon}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fechaCorta.format(new Date(m.fecha))}
                      {m.detalle && m.tipo !== "compra" ? ` · ${m.detalle}` : ""}
                      {pendiente ? ` · Pendiente hasta el ${fechaCorta.format(new Date(m.disponible_desde))}` : ""}
                    </p>
                  </div>
                  <span className={cn("font-bold tabular-nums", m.puntos > 0 ? "text-success" : "text-foreground")}>
                    {m.puntos > 0 ? "+" : "−"}
                    {formatearPuntos(Math.abs(m.puntos))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-bold text-foreground">Cómo funcionan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sumás 1 punto cada {formatearPesos(programa.pesos_por_punto)} que pagás en productos. El envío no suma.</li>
          <li>Los puntos aparecen cuando te entregamos la compra y se liberan {programa.dias_de_espera} días después, al terminar el plazo de arrepentimiento.</li>
          <li>Vencen a los {programa.meses_de_vencimiento} meses de liberarse. Se usan primero los más viejos.</li>
          <li>
            El cupón del canje cubre hasta el {Number(programa.tope_porcentaje)} % de la compra. Si cancelás o devolvés una compra, se anulan los puntos que te
            dio.
          </li>
        </ul>
        <p className="text-xs">[BASES Y CONDICIONES DEL PROGRAMA: A REDACTAR POR UN PROFESIONAL]</p>
      </section>
    </div>
  );
}
