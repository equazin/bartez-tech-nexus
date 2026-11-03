import { Tienda } from "@/components/tienda/Tienda";
import { parrafosDe, useContenidoLegal, type ContenidoLegal } from "@/lib/tienda/legal";
import { usarSeo } from "@/lib/tienda/seo";

type Tipo = "terminos" | "privacidad" | "garantias";

const PAGINAS: Record<Tipo, { titulo: string; clave: keyof ContenidoLegal; marcador: string }> = {
  terminos: { titulo: "Términos y condiciones", clave: "texto_terminos", marcador: "[TÉRMINOS Y CONDICIONES: los redacta un profesional y se cargan desde el panel, en Legal › Textos y datos]" },
  privacidad: { titulo: "Política de privacidad", clave: "texto_privacidad", marcador: "[POLÍTICA DE PRIVACIDAD: la redacta un profesional y se carga desde el panel, en Legal › Textos y datos]" },
  garantias: { titulo: "Garantías y cambios", clave: "texto_garantias", marcador: "[GARANTÍAS Y CAMBIOS: plazo y responsable por marca, a definir; mínimo legal de 6 meses en productos nuevos]" },
};

export default function TextoLegal({ tipo }: { tipo: Tipo }) {
  const pagina = PAGINAS[tipo];
  usarSeo(pagina.titulo);
  const contenido = useContenidoLegal();
  const texto = contenido[pagina.clave];
  const parrafos = parrafosDe(typeof texto === "string" ? texto : null);
  const { datos_legales: datos } = contenido;

  return (
    <Tienda>
      <article className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">{pagina.titulo}</h1>
        {parrafos.length > 0 ? (
          <div className="space-y-4 text-base leading-6">
            {parrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-6 text-muted-foreground">{pagina.marcador}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {datos.razon_social ?? "[RAZÓN SOCIAL]"} · CUIT {datos.cuit ?? "[CUIT]"} · {datos.domicilio ?? "[DOMICILIO LEGAL]"}
        </p>
      </article>
    </Tienda>
  );
}
