import { formatearPuntos, puntosPorMonto, useProgramaDePuntos } from "@/lib/tienda/puntos";
import { cn } from "@/lib/utils";

/** "Sumás N puntos Teqo": solo si el programa está activo y el monto suma al menos un punto. */
export function SumasPuntos({ monto, className, prefijo = "Sumás" }: { monto: number; className?: string; prefijo?: string }) {
  const programa = useProgramaDePuntos();
  const puntos = puntosPorMonto(monto, programa);
  if (puntos <= 0) return null;
  const evento = programa?.eventos.find((e) => e.categorias.length === 0 && e.multiplicador > 1);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 text-[13px]", className)}>
      <span className="inline-flex h-5 items-center rounded-chip bg-success-soft px-2 text-[11px] font-bold text-success">Puntos Teqo</span>
      <span>
        {prefijo} <span className="font-bold tabular-nums">{formatearPuntos(evento ? Math.floor(puntos * evento.multiplicador) : puntos)} puntos</span>
        {evento ? ` (x${Number(evento.multiplicador)} por ${evento.nombre})` : ""} con esta compra
      </span>
    </p>
  );
}
