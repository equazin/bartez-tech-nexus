import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enviarCodigo, verificarCodigo } from "@/lib/tienda/cuenta";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ESPERA_PARA_REENVIAR = 60;

/** Ingreso sin contraseña: email, código de 6 números que llega por email, y adentro. */
export function IngresoConCodigo({ cupon }: { cupon: string | null }) {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const reloj = window.setTimeout(() => setEspera((s) => s - 1), 1_000);
    return () => window.clearTimeout(reloj);
  }, [espera]);

  async function pedirCodigo(evento?: FormEvent) {
    evento?.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError("Revisá el email.");
      return;
    }
    setTrabajando(true);
    setError(null);
    try {
      await enviarCodigo(email);
      setPaso("codigo");
      setCodigo("");
      setEspera(ESPERA_PARA_REENVIAR);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo mandar el código.");
    } finally {
      setTrabajando(false);
    }
  }

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    if (codigo.replace(/\D/g, "").length < 6) {
      setError("El código tiene 6 números.");
      return;
    }
    setTrabajando(true);
    setError(null);
    try {
      await verificarCodigo(email, codigo);
      // La sesión la toma el contexto de autenticación: la página pasa sola a la cuenta.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo entrar.");
      setTrabajando(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="space-y-4">
        <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Mi cuenta</h1>
        <p className="text-muted-foreground">
          Entrás con tu email y un código que te mandamos. No hace falta contraseña ni registrarte aparte: si es la primera vez, la cuenta se crea
          sola.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Ves todas las compras que hiciste con ese email, también las que hiciste sin cuenta.</li>
          <li>Bajás las facturas y seguís los envíos.</li>
          <li>Guardás tus datos y direcciones para comprar más rápido.</li>
          <li>Activás y usás tus cupones.</li>
        </ul>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 sm:p-8">
        {cupon && (
          <p className="rounded-xl bg-secondary p-3 text-sm">
            Para activar el cupón <span className="font-mono font-bold">{cupon}</span>, entrá con el email de la compra.
          </p>
        )}
        {paso === "email" ? (
          <form onSubmit={pedirCodigo} noValidate className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Tu email</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={trabajando}>
              {trabajando ? "Mandando el código" : "Mandame el código"}
            </Button>
          </form>
        ) : (
          <form onSubmit={entrar} noValidate className="space-y-4">
            <p className="text-sm">
              Te mandamos un código a <span className="font-bold">{email.trim()}</span>. Si no lo ves, revisá la carpeta de spam o de promociones.
            </p>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Código</span>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="font-mono text-lg tracking-[0.3em]"
                autoFocus
              />
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={trabajando}>
              {trabajando ? "Entrando" : "Entrar"}
            </Button>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <button type="button" className="underline disabled:no-underline disabled:opacity-60" onClick={() => void pedirCodigo()} disabled={espera > 0 || trabajando}>
                {espera > 0 ? `Mandar otro código en ${espera} s` : "Mandar otro código"}
              </button>
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setPaso("email");
                  setError(null);
                }}
              >
                Usar otro email
              </button>
            </div>
          </form>
        )}
        {error && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted-foreground">Al entrar aceptás la política de privacidad. Usamos tu email solo para tus compras y tu cuenta.</p>
      </section>
    </div>
  );
}
