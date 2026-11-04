import type { ProductoPublico } from "@/lib/tienda/catalogo";
import { esNotebook, fichaAgrupada, paresDeFicha } from "@/lib/tienda/ficha";

/** La descripción puede venir con HTML de las herramientas del panel; se muestra solo el texto. */
export function parrafos(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Especificaciones agrupadas (Pantalla, Rendimiento, Conexiones, Físico, Garantía) en tarjetas. */
export function FichaTecnica({ producto }: { producto: ProductoPublico }) {
  const grupos = fichaAgrupada(paresDeFicha(producto));
  if (grupos.length === 0) return null;

  return (
    <section id="especificaciones" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[26px] font-bold uppercase">Especificaciones</h2>
        <p className="text-[13px] text-muted-foreground">Datos del fabricante, informados por el mayorista.</p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="rounded-2xl border border-border bg-card px-[18px] pb-2.5 pt-1.5">
            <h3 className="pb-2 pt-3.5 font-display text-[15px] font-bold uppercase tracking-[0.08em]">{grupo.titulo}</h3>
            <dl>
              {grupo.pares.map((par) => (
                <div key={par.clave} className="flex justify-between gap-4 border-t border-border py-2.5 text-sm">
                  <dt className="text-muted-foreground">{par.clave}</dt>
                  <dd className="break-words text-right font-medium">{par.valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {esNotebook(producto.categoria_slug) && (
        <p className="text-sm text-muted-foreground">Configuración de fábrica. No ofrecemos ampliaciones de memoria ni de disco.</p>
      )}
    </section>
  );
}
