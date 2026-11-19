import { Link } from "react-router-dom";
import { Tienda } from "@/components/tienda/Tienda";
import ayuda from "@/lib/tienda/ayuda.json";
import { GARANTIAS_POR_DEFECTO, useContenidoLegal } from "@/lib/tienda/legal";
import { usarSeo } from "@/lib/tienda/seo";

/**
 * Una sección de la ayuda. El contenido vive en src/lib/tienda/ayuda.json porque también lo lee scripts/prerender.mjs
 * para escribirlo en el HTML de la página: así lo que ve un buscador es lo mismo que ve una persona.
 */
interface SeccionDeAyuda {
  id: string;
  titulo: string;
  parrafos?: string[];
  lista?: string[];
  cierre?: string[];
  /** "garantias": el resumen de garantías. "contacto": cómo escribirnos, con el email del panel. */
  contenido?: string;
  enlace?: { antes?: string; texto: string; a: string; despues?: string };
}

const SECCIONES = ayuda.secciones as SeccionDeAyuda[];

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-[20px] font-bold leading-[26px]">{titulo}</h2>
      <div className="space-y-2 text-base leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Ayuda() {
  usarSeo("Ayuda", "Envíos, pagos, garantías, cambios y devoluciones en Teqo.");
  // Ayuda muestra el resumen de garantías; el texto completo del panel está en Garantías y cambios.
  const { datos_legales: datos } = useContenidoLegal();

  return (
    <Tienda>
      <div className="container mx-auto grid grid-cols-1 gap-10 px-4 py-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Temas" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex flex-wrap gap-2 text-sm lg:flex-col">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex h-9 items-center rounded-chip bg-secondary px-3 font-medium hover:bg-accent">
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Ayuda</h1>

          {SECCIONES.map((s) => (
            <Seccion key={s.id} id={s.id} titulo={s.titulo}>
              {(s.contenido === "garantias" ? GARANTIAS_POR_DEFECTO : (s.parrafos ?? [])).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {s.lista && (
                <ul className="list-disc space-y-1 pl-5">
                  {s.lista.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {(s.cierre ?? []).map((p, i) => (
                <p key={`cierre-${i}`}>{p}</p>
              ))}
              {s.contenido === "contacto" &&
                (datos.email ? (
                  <p>
                    {ayuda.contacto.antes}
                    <a href={`mailto:${datos.email}`} className="underline">
                      {datos.email}
                    </a>
                    {ayuda.contacto.despues}
                  </p>
                ) : (
                  <p>{ayuda.contacto.sinEmail}</p>
                ))}
              {s.enlace && (
                <p>
                  {s.enlace.antes}
                  <Link to={s.enlace.a} className="underline">
                    {s.enlace.texto}
                  </Link>
                  {s.enlace.despues}
                </p>
              )}
            </Seccion>
          ))}
        </div>
      </div>
    </Tienda>
  );
}
