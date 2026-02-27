import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, Clock } from "lucide-react";
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

  const contactInfo = [
    { icon: Mail, label: "Email", value: "info@barteztecnologia.com", href: "mailto:info@barteztecnologia.com" },
    { icon: Phone, label: "Teléfono", value: "+54 11 1234-5678", href: "tel:+541112345678" },
    { icon: MapPin, label: "Ubicación", value: "Buenos Aires, Argentina" },
    { icon: Clock, label: "Horario", value: "Lun-Vie 9:00-18:00 | Sáb 9:00-13:00" },
  ];

  return (
    <Layout>
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Contacto"
            title="Hablemos sobre su"
            highlight="proyecto"
            description="Nuestro equipo está listo para asesorarlo. Complete el formulario o contáctenos directamente."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <form onSubmit={handleSubmit} className="card-enterprise rounded-xl p-8 lg:p-10 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Nombre *</label>
                    <Input required placeholder="Su nombre" className="input-enterprise" maxLength={100} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">Empresa</label>
                    <Input placeholder="Nombre de la empresa" className="input-enterprise" maxLength={100} />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Email *</label>
                  <Input required type="email" placeholder="correo@empresa.com" className="input-enterprise" maxLength={255} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Teléfono</label>
                  <Input placeholder="+54 11 1234-5678" className="input-enterprise" maxLength={30} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Mensaje *</label>
                  <Textarea required placeholder="¿En qué podemos ayudarle?" rows={5} className="input-enterprise resize-none" maxLength={1000} />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-7 text-sm w-full sm:w-auto"
                >
                  {loading ? "Enviando..." : "Enviar Mensaje"} <Send size={14} className="ml-2" />
                </Button>
              </form>
            </motion.div>

            {/* Contact info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="lg:col-span-2 space-y-4"
            >
              {contactInfo.map((item) => (
                <div key={item.label} className="card-enterprise rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <div className="icon-container h-10 w-10 text-primary shrink-0">
                      <item.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-semibold text-foreground">{item.label}</h4>
                      {item.href ? (
                        <a href={item.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">{item.value}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
