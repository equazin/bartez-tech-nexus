import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  titulo: string;
  bajada?: string;
  enlace?: { texto: string; ruta: string };
  className?: string;
}

/** Título de bloque en Chakra Petch, con una bajada y un "Ver todo" a la derecha. */
export function EncabezadoDeSeccion({ titulo, bajada, enlace, className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[26px] font-bold uppercase leading-tight md:text-[28px]">{titulo}</h2>
        {bajada && <p className="text-[15px] text-muted-foreground">{bajada}</p>}
      </div>
      {enlace && (
        <Link to={enlace.ruta} className="text-sm font-bold hover:underline">
          {enlace.texto} →
        </Link>
      )}
    </div>
  );
}

/** Contenedor de bloque con el ancho de la tienda. */
export function Bloque({ children, className, etiqueta }: { children: ReactNode; className?: string; etiqueta?: string }) {
  return (
    <section aria-label={etiqueta} className={cn("container mx-auto flex flex-col gap-5 px-4", className)}>
      {children}
    </section>
  );
}
