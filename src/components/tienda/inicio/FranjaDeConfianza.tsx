import { Link } from "react-router-dom";
import { CreditCard, Lock, RotateCcw, ShieldCheck, Truck, type LucideIcon } from "lucide-react";
import { promesasDeConfianza, type Portada, type Promesa } from "@/lib/tienda/portada";

const ICONOS: Record<Promesa["clave"], LucideIcon> = {
  envio: Truck,
  garantia: ShieldCheck,
  cuotas: CreditCard,
  arrepentimiento: RotateCcw,
};

/** Las cuatro promesas de Teqo y, debajo, que la tarjeta nunca pasa por nosotros. */
export function FranjaDeConfianza({ portada }: { portada: Pick<Portada, "garantia_meses" | "cuotas_maximas"> }) {
  const promesas = promesasDeConfianza(portada);
  return (
    <section className="container mx-auto space-y-4 px-4 py-10 lg:py-14" aria-label="Por qué comprar en Teqo">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {promesas.map(({ clave, titulo, texto, enlace }) => {
          const Icono = ICONOS[clave];
          return (
            <li key={clave} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
              <Icono className="h-6 w-6 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="font-bold">{titulo}</p>
                <p className="text-sm leading-5 text-muted-foreground">{texto}</p>
                {enlace && (
                  <Link to={enlace.ruta} className="inline-block pt-1 text-sm font-bold hover:underline">
                    {enlace.etiqueta}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" aria-hidden />
        Con tarjeta pagás dentro de Mercado Pago: Teqo no ve ni guarda sus datos.
      </p>
    </section>
  );
}
