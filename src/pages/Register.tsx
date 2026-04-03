import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Landmark, User, Building2, ArrowRight, CheckCircle2, ShieldCheck, Zap, Lock, ChevronRight, Building, ShieldAlert, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { validateCuit } from "@/lib/api/afip";

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

  const steps = [
    { id: 1, label: "Validación Fiscal", icon: Landmark },
    { id: 2, label: "Datos de Acceso", icon: Lock },
    { id: 3, label: "Confirmación", icon: CheckCircle2 },
  ];

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
      setError(err.message || "No pudimos validar este CUIT en AFIP. Verifique los números.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Simulating API call to create B2B profile request
      await new Promise(resolve => setTimeout(resolve, 1800));
      setStep(3);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center py-12 px-4 selection:bg-primary/30">
      {/* Abstract background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[480px] relative z-10"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center p-2 glow-sm group-hover:scale-105 transition-transform">
              <img src="/icon.png" alt="Logo" className="w-full h-full brightness-0 invert" />
            </div>
            <span className="font-display font-black text-2xl tracking-tighter">BARTEZ</span>
          </Link>
          <h1 className="text-3xl font-display font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">Solicitud de Alta B2B</h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="h-px w-8 bg-white/10" />
            <p className="text-sm text-white/50">Canal exclusivo para Empresas</p>
            <span className="h-px w-8 bg-white/10" />
          </div>
        </div>

        {/* Stepper */}
        <div className="flex justify-between mb-10 px-4">
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center relative flex-1">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                ${step === s.id ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(45,159,106,0.2)]' : 
                  step > s.id ? 'border-primary bg-primary text-white' : 'border-white/10 bg-white/5 text-white/30'}
              `}>
                {step > s.id ? <CheckCircle2 size={20} /> : <s.icon size={18} />}
              </div>
              <span className={`text-[10px] mt-2 font-bold uppercase tracking-widest ${step === s.id ? 'text-primary' : 'text-white/30'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`absolute left-[60%] top-5 w-[80%] h-0.5 ${step > s.id ? 'bg-primary' : 'bg-white/10'} transition-all duration-500`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-[32px] p-8 lg:p-10 shadow-2xl shadow-black/50">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handleValidateCuit} className="space-y-6">
                  <div className="flex items-center gap-3 mb-6 bg-primary/5 border border-primary/20 rounded-2xl p-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">Fast-Track Onboarding</p>
                      <p className="text-[11px] text-white/50">Validación instantánea vía AFIP</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase text-white/40 tracking-widest pl-1 mb-2 block">CUIT de la Empresa</label>
                      <div className="relative group">
                        <Landmark size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
                        <Input 
                          value={cuit}
                          onChange={(e) => setCuit(e.target.value)}
                          placeholder="20-XXXXXXXX-X"
                          className="pl-12 h-14 bg-white/[0.03] border-white/10 rounded-2xl focus:ring-primary/20"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                      <ShieldCheck size={16} className="text-primary mt-0.5" />
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Este acceso es exclusivo para empresas con domicilio fiscal en Argentina. La validación se realiza en tiempo real con los registros públicos.
                      </p>
                    </div>
                  </div>

                  {error && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                      <ShieldAlert size={14} /> {error}
                    </motion.p>
                  )}

                  <Button type="submit" className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-primary shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50" disabled={loading}>
                    {loading ? "Validando Entidad..." : "Comenzar Validación"} <ChevronRight size={18} className="ml-1" />
                  </Button>
                </form>
              </motion.div>
            )}

            {step === 2 && afipData && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handleFinalSubmit} className="space-y-6">
                  <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 mb-6 relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-3 text-primary opacity-20 group-hover:opacity-40 transition-opacity">
                      <Building size={40} />
                    </div>
                    <div className="relative z-10">
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 font-display">Entidad Validada</p>
                      <h3 className="text-lg font-bold text-white leading-tight mb-1">{afipData.companyName}</h3>
                      <p className="text-xs text-white/40">{afipData.taxStatus}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="relative group">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tu Nombre — Representante"
                        className="pl-12 h-14 bg-white/[0.03] border-white/10 rounded-2xl"
                        required
                      />
                    </div>
                    <div className="relative group">
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Corporativo (@empresa.com)"
                        className="pl-12 h-14 bg-white/[0.03] border-white/10 rounded-2xl"
                        required
                      />
                    </div>
                    <div className="relative group">
                      <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Crea tu contraseña segura"
                        className="pl-12 h-14 bg-white/[0.03] border-white/10 rounded-2xl font-mono text-sm"
                        required
                      />
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</p>}

                  <Button type="submit" className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-primary shadow-lg shadow-primary/20" disabled={loading}>
                    {loading ? "Procesando Alta..." : "Finalizar Solicitud"}
                  </Button>
                  <button type="button" onClick={() => setStep(1)} className="w-full text-xs text-white/30 hover:text-white/50 transition-colors">Volver a editar CUIT</button>
                </form>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6"
              >
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 glow-sm border border-primary/20">
                   <ShieldCheck size={40} />
                </div>
                <h3 className="text-2xl font-bold mb-3">Solicitud en Revisión</h3>
                <p className="text-white/50 leading-relaxed mb-8 px-4">
                   Hemos validado tus datos fiscales. Un ejecutivo de cuentas ha sido pre-asignado para auditar tu línea de crédito.
                </p>
                
                {/* Business Concierge Card */}
                <div className="bg-[#1A1A1A] border border-white/10 rounded-[28px] p-6 mb-10 text-left relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Users size={80} />
                   </div>
                   <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Tu Ejecutivo Asignado</p>
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 overflow-hidden shrink-0">
                         <img src="https://i.pravatar.cc/150?u=bartez_sales" alt="Sales" className="w-full h-full object-cover grayscale" />
                      </div>
                      <div>
                         <h4 className="font-bold text-base">Carlos Alberto Ruiz</h4>
                         <p className="text-[11px] text-white/40">Head of B2B Sales & Integrators</p>
                         <div className="flex items-center gap-3 mt-2">
                           <span className="flex items-center gap-1 text-[10px] text-primary font-bold"><Zap size={10} /> Online</span>
                           <span className="flex items-center gap-1 text-[10px] text-white/40"><Mail size={10} /> cruiz@bartez.com.ar</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 mb-8 flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Lock size={16} />
                  </div>
                  <p className="text-[11px] text-white/40 leading-tight">Su información está protegida bajo estándares de cumplimiento SOC2 y RGPD.</p>
                </div>

                <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10 hover:bg-white/5" onClick={() => navigate("/login")}>
                  Ir al Login
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step < 3 && (
          <p className="text-center mt-8 text-sm text-white/30">
            ¿Ya eres partner? <Link to="/login" className="text-primary font-bold hover:underline">Iniciar sesión</Link>
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default Register;
