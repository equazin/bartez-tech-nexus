import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Variacion } from "@/lib/panel/formatos";

/** Las piezas que repite el tablero: la tarjeta, el indicador, la lista con barras y el estado vacío. */

export function Tarjeta({
  titulo,
  detalle,
  accion,
  className,
  children,
}: {
  titulo: string;
  detalle?: string;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-tarjeta border border-border/80 bg-card p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
          {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </header>
      {children}
    </section>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Un número del tablero con su variación contra el período anterior. La variación lleva flecha y texto, no solo color. */
export function Indicador({
  etiqueta,
  valor,
  variacion,
  comparacion,
  sinComparacion,
  detalle,
  aviso,
}: {
  etiqueta: string;
  valor: string;
  variacion?: Variacion | null;
  /** Contra qué se compara: "los 7 días anteriores". */
  comparacion?: string;
  /** Qué decir cuando no hay base para comparar. */
  sinComparacion?: string;
  detalle?: string;
  aviso?: string;
}) {
  const Flecha = variacion?.direccion === "sube" ? ArrowUpRight : variacion?.direccion === "baja" ? ArrowDownRight : Minus;
  const tono = variacion?.direccion === "sube" ? "text-success" : variacion?.direccion === "baja" ? "text-danger" : "text-muted-foreground";
  return (
    <div className="flex flex-col rounded-tarjeta border border-border/80 bg-card p-5">
      <p className="text-sm text-muted-foreground">{etiqueta}</p>
      <p className="mt-2 text-[28px] font-bold leading-tight tracking-tight text-foreground">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
      {variacion ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-bold", tono)}>
            <Flecha size={14} aria-hidden />
            {variacion.texto}
          </span>
          {comparacion && <span className="text-muted-foreground">contra {comparacion}</span>}
        </p>
      ) : (
        sinComparacion && <p className="mt-3 text-xs text-muted-foreground">{sinComparacion}</p>
      )}
      {aviso && <p className="mt-2 text-xs text-muted-foreground">{aviso}</p>}
    </div>
  );
}

export interface FilaConBarra {
  clave: string;
  etiqueta: string;
  /** Lo que mide la barra. */
  valor: number;
  /** El valor ya escrito: "$ 1.790", "12". */
  texto: string;
  detalle?: string;
  /** Una marca corta al lado del nombre: "Sin stock". */
  marca?: string;
}

/**
 * Filas ordenadas con una barra fina de un solo color: el largo compara, el número dice cuánto. Las barras salen
 * todas del mismo borde y miden contra `maximo` (por defecto, la fila más grande).
 */
export function ListaConBarras({ filas, maximo, vacio }: { filas: FilaConBarra[]; maximo?: number; vacio: string }) {
  if (filas.length === 0) return <Vacio>{vacio}</Vacio>;
  const tope = Math.max(maximo ?? 0, ...filas.map((f) => f.valor), 1);
  return (
    <ul className="space-y-3">
      {filas.map((fila) => {
        const ancho = Math.max(0, Math.min(100, (fila.valor / tope) * 100));
        return (
          <li key={fila.clave}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-foreground" title={fila.etiqueta}>
                {fila.etiqueta}
                {fila.marca && <span className="ml-2 rounded-chip bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{fila.marca}</span>}
              </p>
              <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">{fila.texto}</p>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-2 min-w-0 flex-1" aria-hidden>
                <div className="h-full rounded-r-[4px] bg-muted-foreground" style={{ width: `${ancho}%`, minWidth: fila.valor > 0 ? 2 : 0 }} />
              </div>
              {fila.detalle && <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{fila.detalle}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
