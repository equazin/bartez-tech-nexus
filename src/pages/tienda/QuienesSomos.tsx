import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Package, Receipt, RotateCcw, ShieldCheck, type LucideIcon } from "lucide-react";
import { DataFiscal } from "@/components/tienda/DataFiscal";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { Tienda } from "@/components/tienda/Tienda";
import { enlaceDeWhatsApp, useContenidoLegal } from "@/lib/tienda/legal";
import textos from "@/lib/tienda/quienesSomos.json";
import { usarSeo } from "@/lib/tienda/seo";

/**
 * Quiénes somos: qué es Teqo, cómo trabaja y cómo se la contacta. Los textos viven en src/lib/tienda/quienesSomos.json
 * porque también los lee scripts/prerender.mjs para escribirlos en el HTML de la página. Los datos de contacto y los
 * fiscales salen del panel (Legal › Textos y datos); lo que no está cargado no se muestra.
 */
const ICONOS: Record<string, LucideIcon> = { caja: Package, garantia: ShieldCheck, precio: Receipt, arrepentimiento: RotateCcw };

const TITULO_DE_SECCION = "font-display text-[26px] font-bold uppercase leading-8";

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] leading-[18px] text-muted-foreground">{etiqueta}</dt>
      {children}
    </div>
  );
}

export default function QuienesSomos() {
  usarSeo(textos.titulo, textos.descripcion);
  const { datos_legales: datos } = useContenidoLegal();
  const whatsapp = enlaceDeWhatsApp(datos.telefono);

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-10 px-4 pb-16 pt-7">
        <div className="flex flex-col gap-4">
          <MigasDePan migas={[{ nombre: textos.titulo }]} />
          <div className="flex flex-col gap-3.5 rounded-2xl bg-placa-foto p-7 text-texto-placa md:p-12">
            <p className="text-[13px] font-bold uppercase leading-[18px] tracking-[0.12em]">{textos.etiqueta}</p>
            <h1 className="font-display text-[40px] font-bold uppercase leading-none md:text-[56px]">{textos.titulo}</h1>
            <p className="max-w-[680px] text-lg leading-7">{textos.bajada}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-x-12 gap-y-10">
          <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-11">
            <section aria-labelledby="como-trabajamos" className="flex flex-col gap-4">
              <h2 id="como-trabajamos" className={TITULO_DE_SECCION}>
                {textos.comoTrabajamos.titulo}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {textos.comoTrabajamos.tarjetas.map((tarjeta) => {
                  const Icono = ICONOS[tarjeta.icono] ?? Package;
                  return (
                    <div key={tarjeta.titulo} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-5">
                      <Icono className="h-[26px] w-[26px]" strokeWidth={1.8} aria-hidden />
                      <p className="text-[17px] font-bold leading-6">{tarjeta.titulo}</p>
                      <p className="text-[15px] leading-[22px] text-muted-foreground">{tarjeta.texto}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="de-donde-sale" className="flex flex-col gap-3.5">
              <h2 id="de-donde-sale" className={TITULO_DE_SECCION}>
                {textos.pedido.titulo}
              </h2>
              <div className="flex max-w-[760px] flex-col gap-3 text-muted-foreground">
                {textos.pedido.parrafos.map((parrafo) => (
                  <p key={parrafo}>{parrafo}</p>
                ))}
              </div>
            </section>

            <section aria-labelledby="como-compras" className="flex flex-col gap-4">
              <h2 id="como-compras" className={TITULO_DE_SECCION}>
                {textos.pasos.titulo}
              </h2>
              <ol className="flex max-w-[760px] flex-col gap-3.5">
                {textos.pasos.lista.map((paso, i) => (
                  <li key={paso.titulo} className="flex items-start gap-3.5">
                    <span aria-hidden className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                      {i + 1}
                    </span>
                    <p className="pt-[3px] text-muted-foreground">
                      <span className="font-bold text-foreground">{paso.titulo}</span> {paso.texto}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside aria-labelledby="contacto-y-datos" className="flex max-w-[460px] flex-[1_1_340px] flex-col gap-[18px] rounded-2xl border border-border bg-card p-6">
            <h2 id="contacto-y-datos" className="font-display text-xl font-bold uppercase leading-[26px]">
              {textos.contacto.titulo}
            </h2>
            <dl className="flex flex-col gap-3.5">
              {datos.cuit && (
                <Dato etiqueta="CUIT">
                  <dd className="tabular-nums">{datos.cuit}</dd>
                </Dato>
              )}
              {datos.domicilio && (
                <Dato etiqueta="Domicilio">
                  <dd>{datos.domicilio}</dd>
                </Dato>
              )}
              {datos.email && (
                <Dato etiqueta="Atención">
                  <dd>
                    <a href={`mailto:${datos.email}`} className="font-bold underline">
                      {datos.email}
                    </a>
                  </dd>
                  {datos.horario && <dd className="text-muted-foreground">{datos.horario}</dd>}
                </Dato>
              )}
              {whatsapp && (
                <Dato etiqueta="WhatsApp">
                  <dd>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                      {datos.telefono}
                    </a>
                  </dd>
                </Dato>
              )}
            </dl>
            {datos.data_fiscal_url && (
              <div className="flex items-center gap-3.5 border-t border-border pt-[18px]">
                <DataFiscal url={datos.data_fiscal_url} />
                <p className="text-sm leading-5 text-muted-foreground">{textos.contacto.dataFiscal}</p>
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {datos.email && (
                <a href={`mailto:${datos.email}`} className="flex h-12 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90">
                  {textos.contacto.escribinos}
                </a>
              )}
              <Link to="/ayuda" className="flex h-12 items-center justify-center rounded-xl border border-foreground font-bold hover:bg-secondary">
                {textos.contacto.ayuda}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </Tienda>
  );
}
