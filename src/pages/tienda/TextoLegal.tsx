import { Skeleton } from "@/components/ui/skeleton";
import { Tienda } from "@/components/tienda/Tienda";
import { CAMBIOS_POR_DEFECTO, GARANTIAS_POR_DEFECTO, parrafosDe, useContenidoLegal, type ContenidoLegal } from "@/lib/tienda/legal";
import { usarSeo } from "@/lib/tienda/seo";

type Tipo = "terminos" | "privacidad" | "garantias";

const PAGINAS: Record<Tipo, { titulo: string; clave: keyof ContenidoLegal; marcador: string }> = {
  terminos: { titulo: "Términos y condiciones", clave: "texto_terminos", marcador: "[TÉRMINOS Y CONDICIONES: los redacta un profesional y se cargan desde el panel, en Legal › Textos y datos]" },
  privacidad: { titulo: "Política de privacidad", clave: "texto_privacidad", marcador: "[POLÍTICA DE PRIVACIDAD: la redacta un profesional y se carga desde el panel, en Legal › Textos y datos]" },
  garantias: { titulo: "Garantías y cambios", clave: "texto_garantias", marcador: "[GARANTÍAS Y CAMBIOS: plazo y responsable por marca, a definir; mínimo legal de 6 meses en productos nuevos]" },
};

/** El ancho de cada renglón mientras llega el texto, para que no parezca una grilla. */
const RENGLONES_DE_ESPERA = [96, 100, 92, 100, 84, 98, 100, 70];

export default function TextoLegal({ tipo }: { tipo: Tipo }) {
  const pagina = PAGINAS[tipo];
  usarSeo(pagina.titulo);
  const contenido = useContenidoLegal();
  const texto = contenido[pagina.clave];
  const cargados = parrafosDe(typeof texto === "string" ? texto : null);
  // Garantías tiene un texto propio mientras el panel no cargue otro; los demás muestran el marcador.
  const parrafos = cargados.length === 0 && tipo === "garantias" ? [...GARANTIAS_POR_DEFECTO, ...CAMBIOS_POR_DEFECTO] : cargados;
  // El marcador y el texto por defecto son para cuando el panel no tiene nada cargado, no para el rato en que
  // la base todavía no respondió: ahí va una espera, y si no responde, un aviso.
  const esperando = contenido.estado === "cargando";
  const sinLeer = contenido.estado === "sin-leer" && cargados.length === 0;

  return (
    <Tienda>
      <article className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">{pagina.titulo}</h1>
        {esperando ? (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando el texto">
            {RENGLONES_DE_ESPERA.map((ancho, i) => (
              <Skeleton key={i} className="h-4" style={{ width: `${ancho}%` }} />
            ))}
          </div>
        ) : sinLeer ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">No pudimos cargar este texto. Probá de nuevo en un rato.</p>
        ) : parrafos.length > 0 ? (
          <div className="space-y-4 text-base leading-6">
            {parrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">{pagina.marcador}</p>
        )}
      </article>
    </Tienda>
  );
}
