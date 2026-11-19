import { Link } from "react-router-dom";
import { Mail, MessageCircle } from "lucide-react";
import { DataFiscal } from "@/components/tienda/DataFiscal";
import { Tienda } from "@/components/tienda/Tienda";
import ayuda from "@/lib/tienda/ayuda.json";
import { GARANTIAS_POR_DEFECTO, enMinuscula, enlaceDeWhatsApp, useContenidoLegal, type DatosLegales } from "@/lib/tienda/legal";
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
  /** "garantias": el resumen de garantías. "contacto": cómo escribirnos y los datos fiscales, con lo cargado en el panel. */
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

/** Cómo escribirnos (email y, si hay teléfono cargado, WhatsApp) y los datos fiscales de la tienda. */
function Contacto({ datos }: { datos: DatosLegales }) {
  const textos = ayuda.contacto;
  const whatsapp = enlaceDeWhatsApp(datos.telefono);
  const hayDatosFiscales = Boolean(datos.cuit || datos.domicilio || datos.data_fiscal_url);

  return (
    <>
      <p>
        {textos.texto}
        {datos.horario ? ` ${textos.horario.replace("{horario}", enMinuscula(datos.horario))}` : ""}
      </p>
      {(datos.email || whatsapp || hayDatosFiscales) && (
        <div className="flex flex-col gap-4 pt-2 text-foreground">
          {(datos.email || whatsapp) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {datos.email && (
                <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <Mail className="h-[26px] w-[26px] shrink-0" strokeWidth={1.8} aria-hidden />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] leading-[18px] text-muted-foreground">{textos.email}</span>
                      <span className="break-words font-bold">{datos.email}</span>
                    </div>
                  </div>
                  <a href={`mailto:${datos.email}`} className="flex h-11 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
                    {textos.escribinos}
                  </a>
                </div>
              )}
              {whatsapp && (
                <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-[26px] w-[26px] shrink-0" strokeWidth={1.8} aria-hidden />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13px] leading-[18px] text-muted-foreground">{textos.whatsapp}</span>
                      <span className="break-words font-bold">{datos.telefono}</span>
                    </div>
                  </div>
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 items-center justify-center rounded-xl border border-foreground text-[15px] font-bold hover:bg-secondary"
                  >
                    {textos.escribinosPorWhatsApp}
                  </a>
                </div>
              )}
            </div>
          )}
          {hayDatosFiscales && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl border border-border bg-secondary p-5">
              <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
                <p className="font-display text-sm font-bold uppercase tracking-[0.08em]">{textos.datosFiscales}</p>
                <dl className="flex flex-wrap gap-x-8 gap-y-2.5">
                  {datos.cuit && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[13px] leading-[18px] text-muted-foreground">CUIT</dt>
                      <dd className="tabular-nums">{datos.cuit}</dd>
                    </div>
                  )}
                  {datos.domicilio && (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[13px] leading-[18px] text-muted-foreground">Domicilio</dt>
                      <dd>{datos.domicilio}</dd>
                    </div>
                  )}
                </dl>
                <p className="text-[15px] leading-[22px]">
                  <Link to="/quienes-somos" className="font-bold underline">
                    {textos.quienesSomos}
                  </Link>
                </p>
              </div>
              {datos.data_fiscal_url && <DataFiscal url={datos.data_fiscal_url} />}
            </div>
          )}
        </div>
      )}
    </>
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
              {s.contenido === "contacto" && <Contacto datos={datos} />}
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
