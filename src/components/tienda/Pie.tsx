import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listarCategorias, type CategoriaPublica } from "@/lib/tienda/catalogo";
import { enMinuscula, enlaceDeWhatsApp, useContenidoLegal } from "@/lib/tienda/legal";
import { abrirAvisoDeCookies } from "@/lib/tienda/medicion";
import { DataFiscal } from "./DataFiscal";

const DEFENSA_DEL_CONSUMIDOR = "https://www.argentina.gob.ar/defensadelconsumidor";

/** Un dato de la tienda en el pie: la etiqueta arriba y el valor abajo. */
function DatoDeLaTienda({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[13px] leading-[18px] text-muted-foreground">{etiqueta}</p>
      <p className="text-[15px] leading-[22px]">{children}</p>
    </div>
  );
}

function Columna({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <nav aria-label={titulo} className="flex min-w-[150px] flex-1 flex-col gap-2.5">
      <p className="font-display text-sm font-bold uppercase tracking-[0.08em]">{titulo}</p>
      {children}
    </nav>
  );
}

const ENLACE = "text-sm text-muted-foreground hover:text-foreground hover:underline";

export function Pie() {
  const anio = new Date().getFullYear();
  const { datos_legales: datos } = useContenidoLegal();
  const whatsapp = enlaceDeWhatsApp(datos.telefono);
  // Lo que no está cargado en el panel no se muestra; sin ningún dato, el bloque entero no va.
  const hayDatosDeLaTienda = Boolean(datos.cuit || datos.domicilio || datos.email || whatsapp || datos.data_fiscal_url);
  const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setCategorias(lista.filter((c) => c.cantidad > 0));
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <footer data-tema="nocturno" className="mt-16 bg-background text-foreground">
      <div className="container mx-auto flex flex-col gap-9 px-4 pb-6 pt-12">
        <div className="flex flex-wrap gap-x-12 gap-y-9">
          <div className="flex min-w-[260px] flex-[1.4] flex-col gap-3.5">
            <img src="/marca/teqo-encendido-fondo-oscuro.svg" alt="teqo." width={2083} height={966} className="h-10 w-auto self-start" />
            <p className="font-display text-xl font-bold uppercase">Subí tu mundo.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Notebooks, gaming, monitores, periféricos y componentes. Envío a domicilio a todo el país, salvo Tierra del Fuego.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-chip border border-border px-3 py-1.5 text-[13px]">Mercado Pago</span>
              <span className="rounded-chip border border-border px-3 py-1.5 text-[13px]">Transferencia bancaria</span>
            </div>
            <p className="text-[13px] text-muted-foreground">No vemos ni guardamos los datos de tu tarjeta.</p>
          </div>

          <Columna titulo="Comprar">
            {categorias.map((c) => (
              <Link key={c.id} to={`/${c.slug}`} className={ENLACE}>
                {c.nombre}
              </Link>
            ))}
            <Link to="/arma-tu-pc" className={ENLACE}>
              Armá tu PC
            </Link>
            <Link to="/ofertas" className={ENLACE}>
              Ofertas
            </Link>
            <Link to="/nuevos-ingresos" className={ENLACE}>
              Nuevos ingresos
            </Link>
          </Columna>

          <Columna titulo="Ayuda">
            <Link to="/quienes-somos" className={ENLACE}>
              Quiénes somos
            </Link>
            <Link to="/ayuda#contacto" className={ENLACE}>
              Contacto
            </Link>
            <Link to="/ayuda" className={ENLACE}>
              Envíos, pagos y garantías
            </Link>
            <Link to="/seguimiento" className={ENLACE}>
              Seguí tu compra
            </Link>
            <Link to="/garantias" className={ENLACE}>
              Garantías y cambios
            </Link>
            <Link to="/comparar" className={ENLACE}>
              Comparador
            </Link>
          </Columna>

          <Columna titulo="Legales">
            <Link to="/terminos" className={ENLACE}>
              Términos y condiciones
            </Link>
            <Link to="/privacidad" className={ENLACE}>
              Privacidad
            </Link>
            <button type="button" onClick={abrirAvisoDeCookies} className={`${ENLACE} text-left`}>
              Cookies
            </button>
            <a href={DEFENSA_DEL_CONSUMIDOR} target="_blank" rel="noopener noreferrer" className={ENLACE}>
              Defensa del consumidor
            </a>
          </Columna>

          <div className="flex min-w-[240px] flex-[1.2] flex-col gap-3 self-start rounded-2xl border border-border bg-background p-5">
            <p className="font-display text-sm font-bold uppercase tracking-[0.08em]">Arrepentimiento</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Podés revocar la compra dentro de los 10 días corridos de recibirla, sin registrarte y con un código al instante.
            </p>
            <Link to="/arrepentimiento" className="flex h-11 items-center justify-center rounded-xl border border-foreground text-sm font-bold hover:bg-secondary">
              Botón de arrepentimiento
            </Link>
          </div>
        </div>

        {hayDatosDeLaTienda && (
          // En el celular va apilado, con el Data Fiscal al costado del CUIT y el domicilio; desde lg, todo en una fila
          // (los dos contenedores intermedios pasan a `contents` y el Data Fiscal se corre al final).
          <div className="flex flex-col gap-3.5 rounded-2xl border border-border p-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-10 lg:gap-y-5 lg:px-6">
            <p className="font-display text-sm font-bold uppercase tracking-[0.08em]">Datos de la tienda</p>
            <div className="flex items-start justify-between gap-4 lg:contents">
              <div className="flex min-w-0 flex-col gap-3.5 lg:contents">
                {datos.cuit && (
                  <DatoDeLaTienda etiqueta="CUIT">
                    <span className="tabular-nums">{datos.cuit}</span>
                  </DatoDeLaTienda>
                )}
                {datos.domicilio && <DatoDeLaTienda etiqueta="Domicilio">{datos.domicilio}</DatoDeLaTienda>}
              </div>
              {datos.data_fiscal_url && <DataFiscal url={datos.data_fiscal_url} className="lg:order-last lg:ml-auto" />}
            </div>
            {datos.email && (
              <DatoDeLaTienda etiqueta={datos.horario ? `Atención · ${enMinuscula(datos.horario)}` : "Atención"}>
                <a href={`mailto:${datos.email}`} className="font-bold underline">
                  {datos.email}
                </a>
              </DatoDeLaTienda>
            )}
            {whatsapp && (
              <DatoDeLaTienda etiqueta="WhatsApp">
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="font-bold underline">
                  {datos.telefono}
                </a>
              </DatoDeLaTienda>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-border pt-5 text-[13px] text-muted-foreground">
          <p>
            Defensa de las y los consumidores: para reclamos{" "}
            <a href={DEFENSA_DEL_CONSUMIDOR} target="_blank" rel="noopener noreferrer" className="text-foreground underline">
              ingresá acá
            </a>
            .
          </p>
          <p>© {anio} Teqo</p>
        </div>
      </div>
    </footer>
  );
}
