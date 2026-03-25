import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Lock, Mail, ArrowRight, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

const Login = () => {
  const navigate = useNavigate();
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate("/b2b-portal");
    }
  }, [session, loading, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError("Credenciales inválidas. Verificá tu email y contraseña.");
      setSubmitting(false);
    }
    // Si no hay error, el AuthContext detecta la sesión y el useEffect redirige
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center py-12 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-3 group mb-6">
            <div className="h-12 w-12 overflow-hidden">
              <img src="/icon.png" alt="Bartez" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-foreground leading-none">
                BARTEZ
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Tecnología
              </span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-foreground text-center">Portal de Clientes</h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-center">
            Ingresá con tu cuenta para acceder a tu catálogo y precios
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface/90 border border-border/40 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@empresa.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Ingresar al Portal <ArrowRight size={15} />
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Solicitar acceso */}
        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            ¿No tenés acceso al portal?
          </p>
          <a
            href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20solicitar%20acceso%20al%20portal%20de%20clientes%20Bartez."
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="gap-2 border-border/40 text-sm w-full">
              <MessageCircle size={15} className="text-green-500" />
              Solicitar acceso por WhatsApp
            </Button>
          </a>
          <Link to="/" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
            Volver al sitio principal
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
