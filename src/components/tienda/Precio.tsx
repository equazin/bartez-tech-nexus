import type { ProductoPublico } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { esSinInteres, mejorPlan, mejorSinInteres, useCuotas } from "@/lib/tienda/cuotas";
import { MEDIO_CON_CUOTAS, nombreCortoDeMedio, preciosDe } from "@/lib/tienda/precios";
import { cn } from "@/lib/utils";

const formatoTasa = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * Las cuotas de Mercado Pago para un monto. Si la cuenta ofrece cuotas sin interés, se destaca el plan sin interés
 * con más cuotas; si no, el plan con más cuotas. En detalle, todos los planes de esa tarjeta.
 */
export function Cuotas({ monto, detallado }: { monto: number; detallado: boolean }) {
  const cuotas = useCuotas(monto);
  if (!cuotas || cuotas.origen === "sin_datos") return null;
  const mejor = mejorPlan(cuotas);
  if (!mejor) return null;
  const sinInteres = mejorSinInteres(cuotas);
  const destacado = sinInteres ?? mejor;
  const { plan } = destacado;
  const masCuotasConInteres = sinInteres !== null && mejor.plan.cuotas > sinInteres.plan.cuotas ? mejor.plan.cuotas : null;
  return (
    <div className="space-y-1">
      {sinInteres ? (
        <p className="text-sm">
          <span className="font-bold tabular-nums">{plan.cuotas} cuotas sin interés</span> de <span className="font-bold tabular-nums">{formatearPesos(plan.monto_cuota)}</span>
        </p>
      ) : (
        <p className="text-sm">
          Hasta <span className="font-bold tabular-nums">{plan.cuotas} cuotas</span> de <span className="font-bold tabular-nums">{formatearPesos(plan.monto_cuota)}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Total {formatearPesos(plan.total)} · CFTEA {formatoTasa.format(plan.cftea)} % · TEA {formatoTasa.format(plan.tea)} %
      </p>
      {masCuotasConInteres !== null && !detallado && <p className="text-xs text-muted-foreground">O hasta {masCuotasConInteres} cuotas con interés.</p>}
      {detallado && (
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border text-sm">
          {destacado.tarjeta.planes
            .filter((p) => p.cuotas >= 2)
            .map((p) => (
              <li key={p.cuotas} className="flex items-center justify-between gap-3 px-3 py-2 tabular-nums">
                <span>
                  {p.cuotas} cuotas {esSinInteres(p) ? <span className="font-bold">sin interés</span> : null} de {formatearPesos(p.monto_cuota)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Total {formatearPesos(p.total)} · CFTEA {formatoTasa.format(p.cftea)} %
                </span>
              </li>
            ))}
        </ul>
      )}
      {detallado && <p className="text-xs text-muted-foreground">Planes de {destacado.tarjeta.nombre} con Mercado Pago. Otras tarjetas pueden ofrecer otras cuotas al pagar.</p>}
    </div>
  );
}

/**
 * "3 cuotas sin interés de $ 55.390" si la cuenta las ofrece, o "hasta 12 cuotas de $ 57.812", en una línea, para
 * las tarjetas. Sin datos de cuotas no muestra nada.
 */
export function CuotasBreves({ monto }: { monto: number }) {
  const cuotas = useCuotas(monto);
  const sinInteres = cuotas ? mejorSinInteres(cuotas) : null;
  if (sinInteres) {
    return (
      <span className="text-xs text-muted-foreground">
        <span className="font-bold text-foreground tabular-nums">{sinInteres.plan.cuotas} cuotas sin interés</span> de{" "}
        <span className="tabular-nums">{formatearPesos(sinInteres.plan.monto_cuota)}</span>
      </span>
    );
  }
  const mejor = cuotas ? mejorPlan(cuotas) : null;
  if (!mejor || mejor.plan.cuotas < 2) return null;
  return (
    <span className="text-xs text-muted-foreground">
      hasta <span className="font-bold text-foreground tabular-nums">{mejor.plan.cuotas} cuotas</span> de <span className="tabular-nums">{formatearPesos(mejor.plan.monto_cuota)}</span>
    </span>
  );
}

interface Props {
  precioFinal: number | null;
  precioLista?: number | null;
  tamano?: "tarjeta" | "ficha";
  /** Consulta las cuotas de Mercado Pago para este monto y muestra el plan con más cuotas. */
  conCuotas?: boolean;
  className?: string;
}

/** Un monto final en pesos, con IVA incluido, y las cuotas de Mercado Pago cuando hay datos. */
export function Precio({ precioFinal, precioLista, tamano = "tarjeta", conCuotas = false, className }: Props) {
  if (precioFinal === null || precioFinal === undefined) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const hayOferta = typeof precioLista === "number" && precioLista > precioFinal;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">{formatearPesos(precioLista)}</span>}
      <span className={cn("font-bold leading-none tabular-nums", tamano === "ficha" ? "text-[28px]" : "text-xl")}>{formatearPesos(precioFinal)}</span>
      <span className="text-xs text-muted-foreground">Precio final con IVA incluido</span>
      {conCuotas && <Cuotas monto={precioFinal} detallado={tamano === "ficha"} />}
    </div>
  );
}

type ProductoConPrecios = Pick<ProductoPublico, "precio_final_ars" | "precio_lista_ars" | "precios_por_medio">;

/**
 * Los precios del producto por medio de pago: el más barato (transferencia) grande y el resto
 * debajo, con las cuotas de Mercado Pago sobre su propio precio.
 */
export function PreciosDelProducto({ producto, tamano = "tarjeta", className }: { producto: ProductoConPrecios; tamano?: "tarjeta" | "ficha" | "destacado"; className?: string }) {
  const precios = preciosDe(producto);
  const principal = precios[0];
  if (!principal || principal.precio === null) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const conCuotas = precios.find((m) => m.id === MEDIO_CON_CUOTAS && m.precio !== null);
  const hayOferta = typeof producto.precio_lista_ars === "number" && producto.precio_lista_ars > principal.precio;

  if (tamano === "tarjeta") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {hayOferta && <span className="text-[13px] tabular-nums text-muted-foreground line-through">{formatearPesos(producto.precio_lista_ars as number)}</span>}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[22px] font-bold leading-tight tracking-[-0.01em] tabular-nums">{formatearPesos(principal.precio)}</span>
          {precios.length > 1 && <span className="text-xs text-muted-foreground">{nombreCortoDeMedio(principal)}</span>}
        </div>
        {precios.slice(1).map((m) =>
          m.precio === null ? null : (
            <span key={m.id} className="text-[13px] leading-snug">
              <span className="font-bold tabular-nums">{formatearPesos(m.precio)}</span> <span className="text-muted-foreground">con {nombreCortoDeMedio(m)}</span>
            </span>
          ),
        )}
        {conCuotas?.precio ? <CuotasBreves monto={conCuotas.precio} /> : <span className="text-xs text-muted-foreground">Precio final con IVA</span>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">Antes {formatearPesos(producto.precio_lista_ars as number)}</span>}
      <div className={cn("grid gap-2", precios.length > 1 && tamano === "ficha" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {precios.map((m, i) =>
          m.precio === null ? null : (
            <div key={m.id} className={cn("flex flex-col gap-1 rounded-xl border bg-background px-3.5 py-3", i === 0 ? "border-foreground" : "border-border")}>
              <span className="text-xs text-muted-foreground">{precios.length > 1 ? `Con ${nombreCortoDeMedio(m).toLowerCase()}` : "Precio final"}</span>
              <span className={cn("font-bold leading-none tracking-[-0.02em] tabular-nums", i === 0 ? "text-[30px] md:text-[34px]" : "text-[22px] md:text-[26px]")}>
                {formatearPesos(m.precio)}
              </span>
            </div>
          ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">Precios finales con IVA incluido. El medio lo elegís al pagar.</p>
      {conCuotas?.precio ? <Cuotas monto={conCuotas.precio} detallado={tamano === "ficha"} /> : null}
    </div>
  );
}
