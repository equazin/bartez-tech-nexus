import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listarCategorias, type CategoriaPublica } from "@/lib/tienda/catalogo";
import { useContenidoLegal } from "@/lib/tienda/legal";

const DEFENSA_DEL_CONSUMIDOR = "https://www.argentina.gob.ar/defensadelconsumidor";

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
    <footer className="mt-16 border-t border-border bg-card">
      <div className="container mx-auto flex flex-col gap-9 px-4 pb-6 pt-12">
        <div className="flex flex-wrap gap-x-12 gap-y-9">
          <div className="flex min-w-[260px] flex-[1.4] flex-col gap-3.5">
            <img src="/marca/teqo-logo-blanco.svg" alt="teqo." className="h-8 w-auto self-start" />
            <p className="font-display text-xl font-bold uppercase">Subí tu mundo.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Notebooks, gaming, monitores, periféricos y componentes. Envío a todo el país, al mismo precio en cualquier provincia.
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
            <Link to="/ofertas" className={ENLACE}>
              Ofertas
            </Link>
            <Link to="/nuevos-ingresos" className={ENLACE}>
              Nuevos ingresos
            </Link>
          </Columna>

          <Columna titulo="Ayuda">
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
            <a href={DEFENSA_DEL_CONSUMIDOR} target="_blank" rel="noopener noreferrer" className={ENLACE}>
              Defensa del consumidor
            </a>
            {datos.data_fiscal_url && (
              <a href={datos.data_fiscal_url} target="_blank" rel="noopener noreferrer" className={ENLACE}>
                Data Fiscal
              </a>
            )}
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

        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-border pt-5 text-[13px] text-muted-foreground">
          <p>
            {datos.razon_social ?? "[RAZÓN SOCIAL]"} · CUIT {datos.cuit ?? "[CUIT]"} · {datos.domicilio ?? "[DOMICILIO LEGAL]"}
            {datos.email ? ` · ${datos.email}` : ""}
          </p>
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
