import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useContenidoLegal } from "@/lib/tienda/legal";

const DEFENSA_DEL_CONSUMIDOR = "https://www.argentina.gob.ar/defensadelconsumidor";

export function Pie() {
  const anio = new Date().getFullYear();
  const { datos_legales: datos } = useContenidoLegal();

  return (
    <footer className="mt-16 border-t border-border bg-background">
      <div className="container mx-auto grid gap-10 px-4 py-12 md:grid-cols-3">
        <div className="space-y-4">
          <img src="/marca/teqo-logo-blanco.svg" alt="teqo." className="h-7 w-auto" />
          <p className="text-sm text-muted-foreground">Subí tu mundo.</p>
          <p className="text-sm text-muted-foreground">
            Notebooks, gaming, monitores y periféricos. Envío a todo el país, al mismo precio en cualquier provincia.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Ayuda</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/ayuda" className="hover:underline">
                Envíos, pagos y garantías
              </Link>
            </li>
            <li>
              <Link to="/seguimiento" className="hover:underline">
                Seguir mi compra
              </Link>
            </li>
            <li>
              <Link to="/terminos" className="hover:underline">
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link to="/privacidad" className="hover:underline">
                Privacidad
              </Link>
            </li>
            <li>
              <Link to="/garantias" className="hover:underline">
                Garantías y cambios
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Arrepentimiento</p>
          <p className="text-sm text-muted-foreground">
            Podés revocar la compra dentro de los 10 días corridos de recibirla, sin registro y con un código al instante.
          </p>
          <Button asChild variant="outline">
            <Link to="/arrepentimiento">Botón de arrepentimiento</Link>
          </Button>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-5 text-xs text-muted-foreground md:flex-row md:flex-wrap md:items-center md:justify-between">
          <p>
            {datos.razon_social ?? "[RAZÓN SOCIAL]"} · CUIT {datos.cuit ?? "[CUIT]"} · {datos.domicilio ?? "[DOMICILIO LEGAL]"}
            {datos.email ? ` · ${datos.email}` : ""}
          </p>
          <p className="flex flex-wrap gap-4">
            {datos.data_fiscal_url && (
              <a href={datos.data_fiscal_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Data Fiscal
              </a>
            )}
            <a href={DEFENSA_DEL_CONSUMIDOR} target="_blank" rel="noopener noreferrer" className="hover:underline">
              Defensa del Consumidor: para reclamos ingresá acá
            </a>
          </p>
          <p>© {anio} Teqo</p>
        </div>
      </div>
    </footer>
  );
}
