import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Landmark, User, Building2, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { validateCuit } from "@/lib/api/afip";
import { supabase } from "@/lib/supabase";

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Step 1: CUIT Validation
  const [cuit, setCuit] = useState("");
  const [afipData, setAfipData] = useState<{ companyName: string; taxStatus: string } | null>(null);

  // Step 2: Contact Info
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const handleValidateCuit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const cleanCuit = cuit.replace(/\D/g, "");
      if (cleanCuit.length !== 11) throw new Error("El CUIT debe tener 11 números");
      
      const result = await validateCuit(cleanCuit);
      setAfipData({ 
        companyName: result.companyName, 
        taxStatus: result.taxStatus.replace(/_/g, " ") 
      });
      setName(result.companyName); // Pre-fill name
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Error validando CUIT con AFIP");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // In a real app: supabase.auth.signUp
      // For this demo: simulating success
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/icon.png" alt="Logo" className="w-8 h-8" />
            <span className="font-bold tracking-tight">BARTEZ</span>
          </Link>
          <h1 className="text-2xl font-bold">Solicitud de Alta B2B</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solo para empresas y revendedores autorizados en Argentina.
          </p>
        </div>

        <div className="bg-surface border border-border/40 rounded-2xl p-8 shadow-xl">
          {step === 1 && (
            <form onSubmit={handleValidateCuit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">CUIT de la Empresa</label>
                <div className="relative">
                  <Landmark size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    placeholder="20-XXXXXXXX-X"
                    className="pl-9"
                    required
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Validaremos tus datos automáticamente en el padrón de AFIP.
                </p>
              </div>

              {error && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? "Validando..." : "Validar Empresa"} <ArrowRight size={15} />
              </Button>
            </form>
          )}

          {step === 2 && afipData && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-primary text-xs font-bold mb-1">
                  <CheckCircle2 size={12} /> DATOS AFIP ENCONTRADOS
                </div>
                <p className="text-sm font-bold">{afipData.companyName}</p>
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{afipData.taxStatus}</p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre de Contacto"
                    className="pl-9"
                    required
                  />
                </div>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    className="pl-9"
                    required
                  />
                </div>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Crear contraseña"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Procesando..." : "Enviar Solicitud"}
              </Button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-bold">Solicitud Enviada</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Un asesor comercial revisará tus datos de AFIP y activará tu cuenta en las próximas 24hs hábiles.
              </p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => navigate("/login")}>
                Volver al Login
              </Button>
            </div>
          )}
        </div>

        {step < 3 && (
          <p className="text-center mt-6 text-sm text-muted-foreground">
            ¿Ya tenés cuenta? <Link to="/login" className="text-primary font-semibold">Iniciar sesión</Link>
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default Register;
