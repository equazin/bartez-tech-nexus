import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, Clock, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import { Link } from "react-router-dom";

const Contact = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  setLoading(true);

  try {
    const form = e.currentTarget;
    const data = new FormData(form);

    const name = String(data.get("name") || "").trim();
    const company = String(data.get("company") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const message = String(data.get("message") || "").trim();

    if (!name || !email || !message) {
      toast({
        title: "Faltan datos",
        description: "Completá nombre, email y mensaje.",
        variant: "destructive",
      });
      return;
    }

    const r = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        message: `Empresa: ${company || "-"}\nTeléfono: ${phone || "-"}\n\n${message}`,
      }),
    });

    // Por si el backend devuelve HTML o texto en un error
    let json: any = null;
    try {
      json = await r.json();
    } catch {
      json = null;
    }

    if (!r.ok || !json?.ok) {
      toast({
        title: "No se pudo enviar",
        description: json?.error || `Error ${r.status}. Reintentá en unos minutos.`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Mensaje enviado",
      description: "Nos pondremos en contacto a la brevedad.",
    });

    form.reset();
  } catch {
    toast({
      title: "Error de conexión",
      description: "No se pudo enviar el mensaje. Reintentá en unos minutos.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};

  const contactInfo = [
    { icon: Mail, label: "Email", value: "contacto@bartez.com.ar", href: "mailto:contacto@bartez.com.ar" },
    { icon: Phone, label: "Teléfono / WhatsApp", value: "+54 9 341 510-4902", href: "https://wa.me/5493415104902" },
    { icon: MapPin, label: "Ubicación", value: "Rosario, Santa Fe, Argentina" },
    { icon: Clock, label: "Horario", value: "Lun-Vie 9:00-18:00" },
  ];

  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Contacto Corporativo"
            title="Hablemos sobre la tecnología de"
            highlight="su empresa"
            description="Nuestro equipo de consultores está listo para entender sus necesidades y proponer la mejor solución."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-5">
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
      <Input name="name" required placeholder="Su nombre" className="input-enterprise" maxLength={100} />
    </div>
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">Empresa</label>
      <Input name="company" placeholder="Nombre de la empresa" className="input-enterprise" maxLength={100} />
    </div>
  </div>

  <div>
    <label className="mb-2 block text-sm font-medium text-foreground">Email *</label>
    <Input name="email" required type="email" placeholder="correo@empresa.com" className="input-enterprise" maxLength={255} />
  </div>

  <div>
    <label className="mb-2 block text-sm font-medium text-foreground">Teléfono</label>
    <Input name="phone" placeholder="+54 11 1234-5678" className="input-enterprise" maxLength={30} />
  </div>

  <div>
    <label className="mb-2 block text-sm font-medium text-foreground">¿En qué podemos ayudarle? *</label>
    <Textarea name="message" required placeholder="Describa brevemente su situación tecnológica o consulta..." rows={5} className="input-enterprise resize-none" maxLength={1000} />
  </div>

  <Button type="submit" disabled={loading} className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-7 text-sm w-full sm:w-auto">
    {loading ? "Enviando..." : "Enviar Mensaje"} <Send size={14} className="ml-2" />
  </Button>
</form>
            </motion.div>

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

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 card-enterprise rounded-xl p-6 lg:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="icon-container h-12 w-12 text-primary shrink-0">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">¿Necesita una evaluación tecnológica?</h3>
                <p className="text-sm text-muted-foreground">Solicite un diagnóstico sin cargo de su infraestructura IT actual.</p>
              </div>
            </div>
            <Link to="/evaluacion-tecnologica" className="shrink-0">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                Evaluación Tecnológica <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
