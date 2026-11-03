import { formatearPesos } from "@/lib/tienda/dinero";
import { mejorPlan, useCuotas } from "@/lib/tienda/cuotas";
import { cn } from "@/lib/utils";

interface Props {
  precioFinal: number | null;
  precioLista?: number | null;
  tamano?: "tarjeta" | "ficha";
  /** Consulta las cuotas de Mercado Pago para este monto y muestra el plan con más cuotas. */
  conCuotas?: boolean;
  className?: string;
}

const formatoTasa = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

function Cuotas({ monto, detallado }: { monto: number; detallado: boolean }) {
  const cuotas = useCuotas(monto);
  if (!cuotas || cuotas.origen === "sin_datos") return null;
  const mejor = mejorPlan(cuotas);
  if (!mejor) return null;
  const { plan } = mejor;
  return (
    <div className="space-y-1">
      <p className="text-sm">
        Hasta <span className="font-bold tabular-nums">{plan.cuotas} cuotas</span> de <span className="font-bold tabular-nums">{formatearPesos(plan.monto_cuota)}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Total {formatearPesos(plan.total)} · CFTEA {formatoTasa.format(plan.cftea)} % · TEA {formatoTasa.format(plan.tea)} %
      </p>
      {detallado && (
        <ul className="mt-2 divide-y divide-border rounded-xl border border-border text-sm">
          {mejor.tarjeta.planes
            .filter((p) => p.cuotas >= 2)
            .map((p) => (
              <li key={p.cuotas} className="flex items-center justify-between gap-3 px-3 py-2 tabular-nums">
                <span>
                  {p.cuotas} cuotas de {formatearPesos(p.monto_cuota)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Total {formatearPesos(p.total)} · CFTEA {formatoTasa.format(p.cftea)} %
                </span>
              </li>
            ))}
        </ul>
      )}
      {detallado && <p className="text-xs text-muted-foreground">Planes de {mejor.tarjeta.nombre} con Mercado Pago. Otras tarjetas pueden ofrecer otras cuotas al pagar.</p>}
    </div>
  );
}

/** Precio final en pesos, con IVA incluido, y las cuotas de Mercado Pago cuando hay datos. */
export function Precio({ precioFinal, precioLista, tamano = "tarjeta", conCuotas = false, className }: Props) {
  if (precioFinal === null || precioFinal === undefined) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const hayOferta = typeof precioLista === "number" && precioLista > precioFinal;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">{formatearPesos(precioLista)}</span>}
      <span className={cn("font-bold leading-none tabular-nums", tamano === "ficha" ? "text-[28px]" : "text-xl")}>
        {formatearPesos(precioFinal)}
      </span>
      <span className="text-xs text-muted-foreground">Precio final con IVA incluido</span>
      {conCuotas && <Cuotas monto={precioFinal} detallado={tamano === "ficha"} />}
    </div>
  );
}
