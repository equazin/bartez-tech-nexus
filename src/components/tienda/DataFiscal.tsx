import { cn } from "@/lib/utils";

/** El logo del formulario 960/D que da ARCA, pedido por https para que el navegador no lo bloquee en la tienda. */
const DATA_FISCAL_LOGO = "https://www.afip.gob.ar/images/f960/DATAWEB.jpg";

/** El logo de Data Fiscal, con el enlace que se carga en el panel: lleva a los datos fiscales del vendedor en ARCA. */
export function DataFiscal({ url, className }: { url: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cn("shrink-0", className)} aria-label="Data Fiscal de ARCA">
      <img src={DATA_FISCAL_LOGO} alt="Data Fiscal" width={239} height={327} loading="lazy" className="h-20 w-auto rounded-md" />
    </a>
  );
}
