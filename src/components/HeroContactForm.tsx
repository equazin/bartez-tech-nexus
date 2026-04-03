import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle2, Loader2 } from "lucide-react";

export default function HeroContactForm() {
  const [email, setEmail]     = useState("");
  const [name, setName]       = useState("");
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresá un email válido");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Consulta rápida desde el home",
          name: name || "Sin nombre",
          email,
          message: `Consulta rápida desde el home.\nNombre: ${name || "-"}\nEmail: ${email}`,
        }),
      });
      setSent(true);
    } catch {
      setError("Error al enviar. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {sent ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/8 px-5 py-3.5"
        >
          <CheckCircle2 size={16} className="text-primary shrink-0" />
          <span className="text-sm text-foreground font-medium">¡Listo! Te contactamos en 24–48hs hábiles.</span>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-2 w-full max-w-md"
        >
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tu nombre"
            className="flex-1 min-w-0 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
          />
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="Email corporativo (@empresa.com)"
            className="flex-1 min-w-0 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-medium"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="hidden sm:inline">Contactar</span>
          </button>
          {error && (
            <p className="absolute -bottom-5 left-0 text-xs text-destructive">{error}</p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
