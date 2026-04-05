import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail, MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isInactive = (location.state as { inactive?: boolean } | null)?.inactive === true;

  useEffect(() => {
    if (!loading && session) {
      navigate("/b2b-portal");
    }
  }, [session, loading, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[18rem] w-[18rem] rounded-full bg-[hsl(var(--gradient-end)/0.14)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center">
          <Link to="/" className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary p-2 shadow-lg shadow-primary/20">
              <img src="/icon.png" alt="Bartez" className="h-full w-full object-contain brightness-0 invert" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold leading-none tracking-tight text-foreground">BARTEZ</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tecnologia</span>
            </div>
          </Link>

          <PageHeader
            align="center"
            eyebrow="Portal B2B"
            title="Ingresa a tu cuenta"
            description="Accede a catalogo, precios y seguimiento de pedidos desde un unico acceso."
          />
        </div>

        <SurfaceCard tone="glass" padding="lg" className="space-y-5">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="tu@empresa.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="password">
                Contrasena
              </label>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="........"
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {isInactive ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-[hsl(var(--warning)/0.22)] bg-[hsl(var(--warning)/0.12)] px-3 py-2 text-sm text-[hsl(var(--warning))]"
              >
                Tu cuenta esta pendiente de aprobacion. Contactanos para activar el acceso.
              </motion.p>
            ) : null}

            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.p>
            ) : null}

            {!isSupabaseConfigured ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-[hsl(var(--warning)/0.22)] bg-[hsl(var(--warning)/0.12)] px-3 py-2 text-sm text-[hsl(var(--warning))]"
              >
                Configuracion local incompleta. Crea un archivo <code>.env</code> con tus credenciales de Supabase antes de usar el portal.
              </motion.p>
            ) : null}

            <Button
              type="submit"
              disabled={submitting || !isSupabaseConfigured}
              className="h-11 w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Ingresar al portal <ArrowRight size={15} />
                </span>
              )}
            </Button>
          </form>
        </SurfaceCard>

        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            No tenes acceso al portal? {" "}
            <Link to="/registrarse" className="font-semibold text-primary hover:underline">
              Registrate aca
            </Link>
          </p>
          <p className="text-[10px] text-muted-foreground/70">O solicita asistencia:</p>
          <Button asChild variant="outline" className="w-full gap-2 text-sm">
            <a
              href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20solicitar%20acceso%20al%20portal%20de%20clientes%20Bartez."
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={15} className="text-green-500" />
              Solicitar acceso por WhatsApp
            </a>
          </Button>
          <Link to="/" className="block text-xs text-muted-foreground transition-colors hover:text-foreground">
            Volver al sitio principal
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
