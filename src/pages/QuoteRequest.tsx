import { useState } from "react";
import { motion } from "framer-motion";
import { Send, FileText } from "lucide-react";
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
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Cotización"
            title="Solicite su"
            highlight="cotización personalizada"
            description="Complete el formulario y nuestro equipo comercial le enviará una propuesta adaptada a sus necesidades."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              onSubmit={handleSubmit}
              className="card-enterprise rounded-xl p-8 lg:p-10 space-y-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="icon-container h-10 w-10 text-primary">
                  <FileText size={18} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">Datos de Cotización</h3>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Nombre completo *</label>
                  <Input required placeholder="Juan Pérez" className="input-enterprise" maxLength={100} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Empresa *</label>
                  <Input required placeholder="Nombre de la empresa" className="input-enterprise" maxLength={100} />
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Email *</label>
                  <Input required type="email" placeholder="correo@empresa.com" className="input-enterprise" maxLength={255} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Teléfono</label>
                  <Input placeholder="+54 11 1234-5678" className="input-enterprise" maxLength={30} />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Categoría de interés</label>
                <Select>
                  <SelectTrigger className="input-enterprise">
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
                <label className="mb-2 block text-sm font-medium text-foreground">Cantidad estimada</label>
                <Input type="number" placeholder="Ej: 10" className="input-enterprise" min={1} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Detalle del requerimiento *</label>
                <Textarea required placeholder="Describa los productos o servicios que necesita cotizar, incluyendo especificaciones técnicas si las tiene..." rows={6} className="input-enterprise resize-none" maxLength={2000} />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-12 text-sm"
              >
                {loading ? "Enviando solicitud..." : "Enviar Solicitud de Cotización"} <Send size={14} className="ml-2" />
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
