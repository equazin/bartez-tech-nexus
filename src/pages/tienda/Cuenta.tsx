import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { FormularioDeMisDatos } from "@/components/tienda/cuenta/FormularioDeMisDatos";
import { IngresoConCodigo } from "@/components/tienda/cuenta/IngresoConCodigo";
import { MisCompras } from "@/components/tienda/cuenta/MisCompras";
import { MisCupones } from "@/components/tienda/cuenta/MisCupones";
import { PrivacidadDeDatos } from "@/components/tienda/cuenta/PrivacidadDeDatos";
import { useAuth } from "@/context/AuthContext";
import { usarSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { id: "compras", nombre: "Mis compras" },
  { id: "cupones", nombre: "Cupones" },
  { id: "datos", nombre: "Mis datos" },
  { id: "privacidad", nombre: "Privacidad" },
] as const;

type Seccion = (typeof SECCIONES)[number]["id"];

/** A dónde vuelve después de entrar: solo rutas de la tienda, nunca otro sitio. */
function destinoSeguro(valor: string | null): string | null {
  return valor && valor.startsWith("/") && !valor.startsWith("//") ? valor : null;
}

export default function Cuenta() {
  usarSeo("Mi cuenta", "Tus compras, facturas, cupones y datos en Teqo. Entrás con tu email y un código, sin contraseña.");
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const cupon = parametros.get("cupon")?.trim().toUpperCase() || null;
  const volver = destinoSeguro(parametros.get("volver"));
  const pedida = parametros.get("seccion") as Seccion | null;
  const [seccion, setSeccion] = useState<Seccion>(cupon ? "cupones" : pedida && SECCIONES.some((s) => s.id === pedida) ? pedida : "compras");

  // Si llegó desde el checkout, vuelve ahí apenas entra.
  useEffect(() => {
    if (user && volver) navigate(volver, { replace: true });
  }, [user, volver, navigate]);

  function elegir(id: Seccion) {
    setSeccion(id);
    const siguientes = new URLSearchParams(parametros);
    siguientes.set("seccion", id);
    siguientes.delete("cupon");
    setParametros(siguientes, { replace: true });
  }

  if (loading) {
    return (
      <Tienda>
        <p className="container mx-auto px-4 py-24 text-muted-foreground">Cargando tu cuenta</p>
      </Tienda>
    );
  }

  if (!user) {
    return (
      <Tienda>
        <div className="container mx-auto px-4 py-8">
          <IngresoConCodigo cupon={cupon} />
        </div>
      </Tienda>
    );
  }

  return (
    <Tienda>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Mi cuenta</h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button asChild variant="outline">
                <Link to="/admin">Ir al panel</Link>
              </Button>
            )}
            <Button variant="ghost" onClick={() => void signOut().then(() => navigate("/cuenta", { replace: true }))}>
              Salir
            </Button>
          </div>
        </div>

        <nav aria-label="Secciones de la cuenta" className="flex flex-wrap gap-2">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => elegir(s.id)}
              aria-current={seccion === s.id ? "page" : undefined}
              className={cn(
                "min-h-10 rounded-chip border px-4 text-sm font-bold transition-colors",
                seccion === s.id ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-secondary",
              )}
            >
              {s.nombre}
            </button>
          ))}
        </nav>

        {seccion === "compras" && <MisCompras />}
        {seccion === "cupones" && <MisCupones cuponInicial={cupon} />}
        {seccion === "datos" && <FormularioDeMisDatos userId={user.id} />}
        {seccion === "privacidad" && <PrivacidadDeDatos />}
      </div>
    </Tienda>
  );
}
