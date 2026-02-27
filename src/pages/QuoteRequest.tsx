import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const QuoteRequest = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Cotización solicitada", description: "Recibirá nuestra propuesta en las próximas 24-48 horas hábiles." });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Cotización"
            title="Solicite su"
            highlight="cotización"
            description="Complete el formulario y nuestro equipo comercial le enviará una propuesta personalizada."
          />

          <div className="mx-auto max-w-2xl">
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmit}
              className="space-y-5 rounded-xl border border-border/50 bg-card p-8"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Nombre completo *</label>
                  <Input required placeholder="Juan Pérez" className="bg-background border-border" maxLength={100} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Empresa *</label>
                  <Input required placeholder="Nombre de la empresa" className="bg-background border-border" maxLength={100} />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Email *</label>
                  <Input required type="email" placeholder="correo@empresa.com" className="bg-background border-border" maxLength={255} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Teléfono</label>
                  <Input placeholder="+54 11 1234-5678" className="bg-background border-border" maxLength={30} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Categoría de interés</label>
                <Select>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Seleccione una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desktop">Desktop PCs</SelectItem>
                    <SelectItem value="notebooks">Notebooks</SelectItem>
                    <SelectItem value="gaming">Gaming PCs</SelectItem>
                    <SelectItem value="networking">Networking</SelectItem>
                    <SelectItem value="servers">Servidores & Infraestructura</SelectItem>
                    <SelectItem value="peripherals">Periféricos</SelectItem>
                    <SelectItem value="components">Componentes</SelectItem>
                    <SelectItem value="services">Servicios IT</SelectItem>
                    <SelectItem value="corporate">Soluciones Corporativas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Cantidad estimada</label>
                <Input type="number" placeholder="Ej: 10" className="bg-background border-border" min={1} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Detalle del requerimiento *</label>
                <Textarea required placeholder="Describa los productos o servicios que necesita cotizar..." rows={5} className="bg-background border-border" maxLength={2000} />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90"
              >
                {loading ? "Enviando..." : "Enviar Solicitud de Cotización"} <Send size={16} className="ml-2" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Responderemos en un plazo de 24-48 horas hábiles.
              </p>
            </motion.form>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default QuoteRequest;
