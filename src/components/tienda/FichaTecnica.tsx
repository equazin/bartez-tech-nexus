import type { ProductoPublico } from "@/lib/tienda/catalogo";

function etiqueta(clave: string): string {
  const limpia = clave.replace(/[_-]+/g, " ").trim();
  return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

function valorComoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (Array.isArray(valor)) return valor.map(valorComoTexto).filter(Boolean).join(", ");
  return "";
}

/** La descripción puede venir con HTML de las herramientas del panel; se muestra solo el texto. */
function parrafos(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function FichaTecnica({ producto }: { producto: ProductoPublico }) {
  const specs = Object.entries(producto.specs ?? {})
    .map(([clave, valor]) => [clave, valorComoTexto(valor)] as const)
    .filter(([, valor]) => valor !== "");
  const descripcion = parrafos(producto.descripcion);

  if (specs.length === 0 && descripcion.length === 0) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {specs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold leading-[26px]">Ficha técnica</h2>
          <dl className="overflow-hidden rounded-2xl border border-border bg-card">
            {specs.map(([clave, valor], i) => (
              <div key={clave} className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 px-4 py-3 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                <dt className="text-muted-foreground">{etiqueta(clave)}</dt>
                <dd className="break-words">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">Configuración de fábrica. No ofrecemos ampliaciones de memoria ni de disco.</p>
        </section>
      )}
      {descripcion.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold leading-[26px]">Descripción</h2>
          <div className="space-y-3 text-base leading-6 text-muted-foreground">
            {descripcion.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
