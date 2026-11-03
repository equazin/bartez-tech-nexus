import { formatearPesos } from "@/lib/tienda/dinero";
import { cn } from "@/lib/utils";

interface Props {
  precioFinal: number | null;
  precioLista?: number | null;
  tamano?: "tarjeta" | "ficha";
  className?: string;
}

/** Precio final en pesos, con IVA incluido. Las cuotas llegan con la fase 4. */
export function Precio({ precioFinal, precioLista, tamano = "tarjeta", className }: Props) {
  if (precioFinal === null || precioFinal === undefined) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const hayOferta = typeof precioLista === "number" && precioLista > precioFinal;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">{formatearPesos(precioLista)}</span>}
      <span className={cn("font-bold leading-none tabular-nums", tamano === "ficha" ? "text-[28px]" : "text-xl")}>
        {formatearPesos(precioFinal)}
      </span>
      <span className="text-xs text-muted-foreground">Precio final con IVA incluido</span>
    </div>
  );
}
