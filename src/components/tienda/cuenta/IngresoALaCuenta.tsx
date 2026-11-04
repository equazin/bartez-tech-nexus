import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLAVE_MINIMA, crearCuenta, entrarConClave, entrarConGoogle, googleDisponible, pedirNuevaClave } from "@/lib/tienda/cuenta";
import { cn } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Modo = "entrar" | "crear" | "olvide";

/** La "G" de Google para el botón de ingreso, con sus colores, como pide su guía de marca. */
function LogoDeGoogle() {
  return (
    <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function CampoDeClave({ valor, cambiar, autoComplete }: { valor: string; cambiar: (v: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} value={valor} onChange={(e) => cambiar(e.target.value)} autoComplete={autoComplete} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

/**
 * Ingreso a Mi cuenta: con Google o con email y contraseña. Crear la cuenta pide confirmar el email; quien entraba
 * antes con un código ya tiene cuenta y crea su contraseña con "Olvidé mi contraseña".
 */
export function IngresoALaCuenta({ cupon, volver }: { cupon: string | null; volver: string | null }) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conGoogle, setConGoogle] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void googleDisponible().then((si) => {
      if (!cancelado) setConGoogle(si);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError(null);
    setAviso(null);
  }

  async function conPausa(tarea: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    setAviso(null);
    try {
      await tarea();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No pudimos completar el ingreso.");
    } finally {
      setTrabajando(false);
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpio = email.trim();
    if (!EMAIL.test(limpio)) {
      setError("Revisá el email.");
      return;
    }
    if (modo === "olvide") {
      void conPausa(async () => {
        await pedirNuevaClave(limpio);
        setAviso(`Si ${limpio} tiene cuenta, te mandamos un enlace para elegir la contraseña. Si no lo ves, revisá spam o promociones.`);
      });
      return;
    }
    if (clave.length < CLAVE_MINIMA) {
      setError(`La contraseña tiene que tener al menos ${CLAVE_MINIMA} caracteres.`);
      return;
    }
    if (modo === "entrar") {
      // La sesión la toma el contexto de autenticación: la página pasa sola a la cuenta.
      void conPausa(() => entrarConClave(limpio, clave));
      return;
    }
    void conPausa(async () => {
      const resultado = await crearCuenta(limpio, clave, volver);
      if (resultado === "ya_existe") {
        setError(null);
        setAviso("Ese email ya tiene cuenta. Entrá con tu contraseña; si nunca creaste una (antes se entraba con un código), tocá \"Olvidé mi contraseña\".");
        setModo("entrar");
      } else if (resultado === "confirmar") {
        setAviso(`Te mandamos un email a ${limpio}. Tocá el enlace para confirmar la cuenta y volvés acá con la sesión abierta.`);
      }
    });
  }

  const titulo = modo === "crear" ? "Crear cuenta" : modo === "olvide" ? "Elegir una contraseña nueva" : "Entrar";
  const textoDelBoton = trabajando
    ? modo === "olvide"
      ? "Mandando el enlace"
      : modo === "crear"
        ? "Creando la cuenta"
        : "Entrando"
    : modo === "olvide"
      ? "Mandame el enlace"
      : modo === "crear"
        ? "Crear cuenta"
        : "Entrar";

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="space-y-4">
        <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Mi cuenta</h1>
        <p className="text-muted-foreground">Entrá con tu cuenta de Google o con tu email y una contraseña.</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Ves todas las compras que hiciste con ese email, también las que hiciste sin cuenta.</li>
          <li>Bajás las facturas y seguís los envíos.</li>
          <li>Guardás tus datos y direcciones para comprar más rápido.</li>
          <li>Activás y usás tus cupones.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Si antes entrabas con un código por email, tu cuenta sigue igual: tocá "Olvidé mi contraseña" para crear una, o entrá con Google si tu email es de
          Gmail.
        </p>
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
        {cupon && (
          <p className="rounded-xl bg-secondary p-3 text-sm">
            Para activar el cupón <span className="font-mono font-bold">{cupon}</span>, entrá con el email de la compra.
          </p>
        )}

        {modo !== "olvide" && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1" role="tablist" aria-label="Entrar o crear cuenta">
            {(["entrar", "crear"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={modo === m}
                onClick={() => cambiarModo(m)}
                className={cn("h-10 rounded-lg text-sm font-bold transition-colors", modo === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "entrar" ? "Entrar" : "Crear cuenta"}
              </button>
            ))}
          </div>
        )}

        {conGoogle && modo !== "olvide" && (
          <>
            <button
              type="button"
              onClick={() => void conPausa(() => entrarConGoogle(volver))}
              disabled={trabajando}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-input bg-card font-bold hover:bg-secondary disabled:opacity-60"
            >
              <LogoDeGoogle />
              Seguir con Google
            </button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />o con tu email
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={enviar} noValidate className="space-y-4">
          {modo === "olvide" && (
            <div className="space-y-1">
              <p className="font-bold">{titulo}</p>
              <p className="text-sm text-muted-foreground">Te mandamos un enlace al email para elegir la contraseña. Sirve también para crear la primera.</p>
            </div>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
          </label>
          {modo !== "olvide" && (
            <label className="block space-y-1 text-sm">
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-medium">Contraseña</span>
                {modo === "entrar" && (
                  <button type="button" onClick={() => cambiarModo("olvide")} className="text-xs underline">
                    Olvidé mi contraseña
                  </button>
                )}
              </span>
              <CampoDeClave valor={clave} cambiar={setClave} autoComplete={modo === "crear" ? "new-password" : "current-password"} />
              {modo === "crear" && <span className="block text-xs text-muted-foreground">Al menos {CLAVE_MINIMA} caracteres.</span>}
            </label>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={trabajando}>
            {textoDelBoton}
          </Button>
          {modo === "olvide" && (
            <button type="button" onClick={() => cambiarModo("entrar")} className="text-sm underline">
              Volver a entrar
            </button>
          )}
        </form>

        {aviso && <p className="rounded-xl bg-exito-fondo p-3 text-sm">{aviso}</p>}
        {error && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted-foreground">Al entrar aceptás la política de privacidad. Usamos tu email solo para tus compras y tu cuenta.</p>
      </section>
    </div>
  );
}
