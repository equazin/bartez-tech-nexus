import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { decidirCookies, escucharAvisoDeCookies, iniciarMedicion, permisoDeCookies } from "@/lib/tienda/medicion";

/**
 * El aviso de cookies: Google y Meta se activan recién al aceptar. Aparece la primera vez y cuando se elige "Cookies"
 * en el pie. Aceptar y rechazar pesan lo mismo, y rechazar no cambia nada en la compra.
 */
export function AvisoDeCookies() {
  const [abierto, setAbierto] = useState(() => permisoDeCookies() === null);

  useEffect(() => {
    iniciarMedicion();
    return escucharAvisoDeCookies(() => setAbierto(true));
  }, []);

  if (!abierto) return null;

  function decidir(acepta: boolean) {
    setAbierto(false);
    decidirCookies(acepta);
  }

  return (
    <div role="dialog" aria-label="Cookies" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card shadow-[0_-12px_32px_rgba(0,0,0,0.12)]">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Usamos cookies de Google y Meta para medir las visitas y mostrar mejor nuestra publicidad, solo si nos das permiso. Las que necesita la tienda para funcionar
          van siempre. Más detalles en la{" "}
          <Link to="/privacidad" className="text-foreground underline">
            política de privacidad
          </Link>
          .
        </p>
        <div className="grid shrink-0 grid-cols-2 gap-2 md:flex">
          <Button variant="outline" onClick={() => decidir(false)}>
            Rechazar
          </Button>
          <Button variant="outline" onClick={() => decidir(true)}>
            Aceptar
          </Button>
        </div>
      </div>
    </div>
  );
}
