import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/** Un bloque de la portada: titular, bajada opcional, "Ver todo" y su contenido. */
export function BloqueDeProductos({
  titulo,
  bajada,
  verTodo,
  id,
  principal = false,
  children,
}: {
  titulo: string;
  /** true en una página propia: el titular pasa a ser el h1. */
  principal?: boolean;
  bajada?: string;
  verTodo?: { ruta: string; etiqueta?: string };
  id?: string;
  children: ReactNode;
}) {
  const idTitulo = id ? `${id}-titulo` : undefined;
  const Titular = principal ? "h1" : "h2";
  return (
    <section className="container mx-auto px-4 py-10 lg:py-14" aria-labelledby={idTitulo}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Titular id={idTitulo} className={principal ? "text-[40px] font-bold leading-[44px] tracking-[-1px]" : "text-[28px] font-bold leading-[34px] tracking-[-0.5px]"}>
            {titulo}
          </Titular>
          {bajada && <p className="text-sm text-muted-foreground">{bajada}</p>}
        </div>
        {verTodo && (
          <Link to={verTodo.ruta} className="inline-flex items-center gap-1 text-sm font-bold hover:underline">
            {verTodo.etiqueta ?? "Ver todo"} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
