import { useState } from "react";
import { BarChart2, Table } from "lucide-react";
import { cn } from "@/lib/utils";
import { topeRedondo } from "@/lib/panel/formatos";
import { etiquetaCortaDelDia, etiquetaLargaDelDia, etiquetaNumericaDelDia } from "@/lib/panel/periodos";
import { Tarjeta, Vacio } from "./piezas";

export interface DatoDelDia {
  dia: string;
  valor: number;
  /** Lo que acompaña al valor: "2 compras". */
  detalle?: string;
}

const ALTO_DEL_GRAFICO = 168;
const DIAS_CON_ETIQUETA = 8;

/**
 * Una barra por día, de un solo color; el día de hoy va en el color de la marca. Cada barra responde al puntero y
 * al teclado con el día y el valor, y la misma información está en la tabla: el gráfico nunca es la única forma
 * de leer un número.
 */
export function BarrasPorDia({
  titulo,
  detalle,
  datos,
  hoy,
  queMide,
  formato,
  formatoDelEje,
  vacio,
  className,
}: {
  titulo: string;
  detalle?: string;
  datos: DatoDelDia[];
  /** El día de hoy (AAAA-MM-DD): su barra se destaca. */
  hoy: string;
  /** El encabezado de la columna de valores en la tabla: "Cobrado", "Visitas". */
  queMide: string;
  formato: (valor: number) => string;
  formatoDelEje: (valor: number) => string;
  vacio: string;
  className?: string;
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const [comoTabla, setComoTabla] = useState(false);

  const maximo = Math.max(0, ...datos.map((d) => d.valor));
  const tope = topeRedondo(maximo);
  const cada = Math.max(1, Math.ceil(datos.length / DIAS_CON_ETIQUETA));
  const etiquetaDelEje = datos.length <= 10 ? etiquetaCortaDelDia : etiquetaNumericaDelDia;
  const elegido = activo !== null ? datos[activo] : null;

  const boton = (
    <button
      type="button"
      onClick={() => setComoTabla((v) => !v)}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {comoTabla ? <BarChart2 size={14} aria-hidden /> : <Table size={14} aria-hidden />}
      {comoTabla ? "Ver gráfico" : "Ver tabla"}
    </button>
  );

  return (
    <Tarjeta titulo={titulo} detalle={detalle} accion={boton} className={className}>
      {comoTabla ? (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Día</th>
                <th className="py-2 text-right font-medium">{queMide}</th>
                <th className="py-2 pl-4 text-right font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.dia} className="border-b border-border/60 last:border-0">
                  <td className="py-2 text-foreground">{etiquetaLargaDelDia(d.dia)}</td>
                  <td className="py-2 text-right font-medium tabular-nums text-foreground">{formato(d.valor)}</td>
                  <td className="py-2 pl-4 text-right tabular-nums text-muted-foreground">{d.detalle ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : maximo <= 0 ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <div>
          <div className="flex gap-3">
            <div className="flex w-14 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground" style={{ height: ALTO_DEL_GRAFICO }} aria-hidden>
              <span className="-translate-y-1.5">{formatoDelEje(tope)}</span>
              <span className="translate-y-1.5">0</span>
            </div>
            <div className="relative min-w-0 flex-1" style={{ height: ALTO_DEL_GRAFICO }}>
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-border/70" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-border/70" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />
              <div className="absolute inset-0 flex items-end">
                {datos.map((d, i) => {
                  const alto = (d.valor / tope) * 100;
                  return (
                    <button
                      key={d.dia}
                      type="button"
                      aria-label={`${etiquetaLargaDelDia(d.dia)}: ${formato(d.valor)}${d.detalle ? `, ${d.detalle}` : ""}`}
                      onPointerEnter={() => setActivo(i)}
                      onPointerLeave={() => setActivo((actual) => (actual === i ? null : actual))}
                      onFocus={() => setActivo(i)}
                      onBlur={() => setActivo((actual) => (actual === i ? null : actual))}
                      className="group flex h-full min-w-0 flex-1 cursor-default items-end justify-center px-px focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "block w-full max-w-[24px] rounded-t-[4px] transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-1 group-focus-visible:ring-offset-card",
                          d.dia === hoy ? "bg-primary" : "bg-muted-foreground",
                          activo !== null && activo !== i && "opacity-45",
                        )}
                        style={{ height: `${alto}%`, minHeight: d.valor > 0 ? 2 : 0 }}
                      />
                    </button>
                  );
                })}
              </div>
              {elegido && activo !== null && (
                <div
                  role="status"
                  className={cn(
                    "pointer-events-none absolute -top-2 z-10 w-max max-w-[220px] -translate-y-full rounded-lg border border-border bg-popover px-3 py-2 text-left shadow-md",
                    activo / datos.length < 0.2 ? "left-0" : activo / datos.length > 0.8 ? "right-0" : "-translate-x-1/2",
                  )}
                  style={activo / datos.length >= 0.2 && activo / datos.length <= 0.8 ? { left: `${((activo + 0.5) / datos.length) * 100}%` } : undefined}
                >
                  <p className="text-sm font-bold text-popover-foreground">{formato(elegido.valor)}</p>
                  <p className="text-xs text-muted-foreground">
                    {etiquetaLargaDelDia(elegido.dia)}
                    {elegido.dia === hoy ? " (hoy)" : ""}
                    {elegido.detalle ? ` · ${elegido.detalle}` : ""}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex gap-3" aria-hidden>
            <div className="w-14 shrink-0" />
            <div className="flex min-w-0 flex-1">
              {datos.map((d, i) => {
                // Con muchos días se rotula uno cada tantos, contando desde el último para que hoy siempre tenga rótulo.
                const visible = (datos.length - 1 - i) % cada === 0;
                return (
                  <span key={d.dia} className={cn("flex min-w-0 flex-1 justify-center text-[11px]", d.dia === hoy ? "font-bold text-foreground" : "text-muted-foreground")}>
                    <span className="whitespace-nowrap">{visible ? (d.dia === hoy ? "hoy" : etiquetaDelEje(d.dia)) : ""}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}
