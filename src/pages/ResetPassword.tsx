import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type Phase = "request" | "update" | "done";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Supabase redirige con #access_token en el hash cuando el usuario hace clic
  // en el link del email. Detectamos ese token para pasar a la fase de update.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token") && hash.includes("type=recovery")) {
      setPhase("update");
    }
  }, []);

  const handleRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setPhase("done");
    }
  };

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      // Sign out so the user logs in fresh with their new password
      await supabase.auth.signOut();
      navigate("/login", { state: { passwordReset: true } });
    }
  };

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
            <img
              src="/android-chrome-512x512.png"
              alt="Bartez"
              className="h-16 w-16 rounded-2xl object-contain"
            />
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold leading-none tracking-tight text-foreground">BARTEZ</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tecnologia</span>
            </div>
          </Link>

          <PageHeader
            align="center"
            eyebrow="Portal B2B"
            title={
              phase === "request" ? "Recuperar contraseña" :
              phase === "update"  ? "Nueva contraseña" :
              "Revisá tu email"
            }
            description={
              phase === "request" ? "Te enviaremos un link para restablecer tu acceso." :
              phase === "update"  ? "Elegí una contraseña nueva para tu cuenta." :
              "Si el email está registrado, recibirás el link en los próximos minutos."
            }
          />
        </div>

        <SurfaceCard tone="glass" padding="lg" className="space-y-5">

          {phase === "request" && (
            <form className="space-y-5" onSubmit={handleRequest}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="email">
                  Email de tu cuenta
                </label>
                <div className="relative">
                  <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="tu@empresa.com"
                    className="pl-9"
                    autoComplete="email"
                    disabled={!isSupabaseConfigured}
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={submitting || !isSupabaseConfigured}
                className="h-11 w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Enviar link de recuperación <ArrowRight size={15} />
                  </span>
                )}
              </Button>
            </form>
          )}

          {phase === "update" && (
            <form className="space-y-5" onSubmit={handleUpdate}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="password">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="confirm">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Repetí la contraseña"
                    className="pl-9"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                    Guardando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Guardar nueva contraseña <ArrowRight size={15} />
                  </span>
                )}
              </Button>
            </form>
          )}

          {phase === "done" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mail size={24} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Revisá tu bandeja de entrada y también la carpeta de spam.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Volver al login</Link>
              </Button>
            </div>
          )}
        </SurfaceCard>

        {phase !== "done" && (
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Volver al login
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
