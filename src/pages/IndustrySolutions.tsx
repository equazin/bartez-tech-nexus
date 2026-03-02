import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Factory, GraduationCap, Heart, ShoppingCart, ArrowRight, CheckCircle2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const industries = [
  {
    icon: Building2,
    title: "Oficinas Profesionales",
    subtitle: "Estudios jurídicos, contables, consultoras y oficinas corporativas",
    challenge: "Las oficinas profesionales necesitan tecnología confiable que funcione sin interrupciones. Cada hora de inactividad impacta directamente en la productividad y facturación del equipo.",
    solutions: [
      "Estaciones de trabajo configuradas a medida para cada rol",
      "Redes seguras con VPN para trabajo remoto e híbrido",
      "Sistemas de backup automático y recuperación de datos",
      "Soporte técnico con tiempos de respuesta garantizados",
      "Gestión centralizada de licencias y actualizaciones",
    ],
  },
  {
    icon: Factory,
    title: "Industria y Manufactura",
    subtitle: "Plantas industriales, centros logísticos y operaciones de producción",
    challenge: "Los entornos industriales exigen infraestructura IT robusta que soporte operaciones 24/7, sistemas de control y conectividad en condiciones exigentes.",
    solutions: [
      "Equipamiento ruggedizado para entornos industriales",
      "Redes industriales con cobertura WiFi en planta",
      "Servidores para sistemas ERP, MES y SCADA",
      "Monitoreo remoto de infraestructura crítica",
      "Planes de contingencia y continuidad operativa",
    ],
  },
  {
    icon: GraduationCap,
    title: "Instituciones Educativas",
    subtitle: "Universidades, colegios, centros de formación y academias",
    challenge: "Las instituciones educativas requieren tecnología que facilite la enseñanza presencial y virtual, protegiendo los datos de estudiantes y personal.",
    solutions: [
      "Laboratorios informáticos con equipos estandarizados",
      "Infraestructura de red para campus con alta densidad de usuarios",
      "Plataformas de colaboración y videoconferencia",
      "Seguridad perimetral y filtrado de contenidos",
      "Soporte técnico especializado para entornos educativos",
    ],
  },
  {
    icon: Heart,
    title: "Organizaciones de Salud",
    subtitle: "Hospitales, clínicas, laboratorios y centros médicos",
    challenge: "El sector salud maneja datos sensibles y requiere sistemas con alta disponibilidad. La tecnología debe cumplir con estándares de seguridad y privacidad.",
    solutions: [
      "Infraestructura para historias clínicas electrónicas",
      "Redes segmentadas con cumplimiento normativo",
      "Servidores redundantes para sistemas críticos",
      "Equipamiento para telemedicina y diagnóstico remoto",
      "Backup y recuperación ante desastres para datos clínicos",
    ],
  },
  {
    icon: ShoppingCart,
    title: "Retail y Comercio",
    subtitle: "Cadenas comerciales, franquicias y negocios con múltiples sucursales",
    challenge: "El retail necesita conectividad entre sucursales, sistemas POS confiables y una infraestructura que escale junto con el crecimiento del negocio.",
    solutions: [
      "Sistemas de punto de venta (POS) y terminales",
      "Conectividad segura entre casa central y sucursales",
      "Infraestructura de red WiFi para clientes y operación",
      "Servidores centralizados para gestión de inventario",
      "Soporte remoto y on-site para múltiples locaciones",
    ],
  },
];

const IndustrySolutions = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Soluciones por Industria"
            title="Tecnología especializada para"
            highlight="cada sector"
            description="Entendemos los desafíos tecnológicos de cada industria. Diseñamos soluciones que responden a las necesidades específicas de su sector."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8 space-y-8">
          {industries.map((ind, i) => (
            <motion.div
              key={ind.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="card-enterprise rounded-xl p-8 lg:p-10"
            >
              <div className="grid gap-8 lg:grid-cols-5">
                <div className="lg:col-span-2">
                  <div className="icon-container h-12 w-12 text-primary mb-4">
                    <ind.icon size={22} />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">{ind.title}</h3>
                  <p className="mt-1 text-sm text-primary/70 font-medium">{ind.subtitle}</p>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{ind.challenge}</p>
                  <Link to="/evaluacion-tecnologica" className="mt-6 inline-flex items-center text-sm font-medium text-primary transition-all hover:gap-2 gap-1">
                    Solicitar evaluación <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="lg:col-span-3">
                  <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 mb-4">Cómo lo resolvemos</h4>
                  <ul className="space-y-3">
                    {ind.solutions.map((sol) => (
                      <li key={sol} className="flex items-start gap-3 text-sm text-secondary-foreground">
                        <CheckCircle2 size={15} className="text-primary mt-0.5 shrink-0" />
                        {sol}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}

          <div className="mt-12">
            <EnterpriseCTA
              badge="Su Industria, Nuestra Experiencia"
              badgeIcon={Briefcase}
              title="¿No encuentra su sector?"
              highlight="Hablemos"
              description="Con más de 15 años de experiencia, hemos trabajado con empresas de prácticamente todos los sectores. Contáctenos para una evaluación personalizada."
              primaryLabel="Solicitar Evaluación Tecnológica"
              primaryTo="/evaluacion-tecnologica"
              secondaryLabel="Contactar un Especialista"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default IndustrySolutions;
