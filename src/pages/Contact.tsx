import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const Contact = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({ title: "Mensaje enviado", description: "Nos pondremos en contacto a la brevedad." });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Contacto"
            title="Póngase en"
            highlight="contacto"
            description="Estamos listos para ayudarle. Complete el formulario o contáctenos directamente."
          />

          <div className="grid gap-10 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Nombre</label>
                    <Input required placeholder="Su nombre" className="bg-card border-border" maxLength={100} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Empresa</label>
                    <Input placeholder="Nombre de la empresa" className="bg-card border-border" maxLength={100} />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <Input required type="email" placeholder="correo@empresa.com" className="bg-card border-border" maxLength={255} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Teléfono</label>
                  <Input placeholder="+54 11 1234-5678" className="bg-card border-border" maxLength={30} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Mensaje</label>
                  <Textarea required placeholder="¿En qué podemos ayudarle?" rows={5} className="bg-card border-border" maxLength={1000} />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 sm:w-auto"
                >
                  {loading ? "Enviando..." : "Enviar Mensaje"} <Send size={16} className="ml-2" />
                </Button>
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {[
                { icon: Mail, label: "Email", value: "info@barteztecnologia.com" },
                { icon: Phone, label: "Teléfono", value: "+54 11 1234-5678" },
                { icon: MapPin, label: "Ubicación", value: "Buenos Aires, Argentina" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4 rounded-xl border border-border/50 bg-card p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-foreground">{item.label}</h4>
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-border/50 bg-card p-5">
                <h4 className="font-display font-semibold text-foreground mb-2">Horario de Atención</h4>
                <p className="text-sm text-muted-foreground">Lunes a Viernes: 9:00 - 18:00</p>
                <p className="text-sm text-muted-foreground">Sábados: 9:00 - 13:00</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
