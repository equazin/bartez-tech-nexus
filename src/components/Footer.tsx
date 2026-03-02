import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const footerLinks = {
  soluciones: [
    { label: "Soluciones Corporativas", href: "/soluciones-corporativas" },
    { label: "Soluciones por Industria", href: "/soluciones-por-industria" },
    { label: "Tecnología Corporativa", href: "/tecnologia" },
    { label: "Servicios IT", href: "/servicios-it" },
    { label: "Partnership Empresarial", href: "/partnership" },
  ],
  empresa: [
    { label: "Sobre Nosotros", href: "/nosotros" },
    { label: "Contacto", href: "/contacto" },
    { label: "Evaluación Tecnológica", href: "/evaluacion-tecnologica" },
  ],
};

const Footer = () => {
  return (
    <footer className="border-t border-border/40">
      {/* Pre-footer CTA */}
      <div className="bg-surface">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-12 lg:py-16">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground md:text-2xl">
                ¿Listo para profesionalizar la <span className="text-gradient">tecnología de su empresa?</span>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-lg">
                Solicite una evaluación tecnológica sin cargo y descubra cómo optimizar su infraestructura IT.
              </p>
            </div>
            <Link to="/evaluacion-tecnologica" className="shrink-0">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-12 px-8 text-sm">
                Evaluación Tecnológica <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="section-divider" />

      <div className="bg-background">
        <div className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                  <span className="font-display text-sm font-bold text-primary-foreground">B</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-sm font-bold tracking-tight text-foreground leading-none">BARTEZ</span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground leading-none mt-0.5">Tecnología</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Partner tecnológico para empresas argentinas. Gestionamos, implementamos y hacemos evolucionar la infraestructura IT de su organización. Más de 15 años de experiencia.
              </p>
              <div className="mt-6 space-y-2.5">
                <a href="mailto:info@barteztecnologia.com" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail size={13} className="text-primary/70" /> info@barteztecnologia.com
                </a>
                <a href="tel:+541112345678" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone size={13} className="text-primary/70" /> +54 11 1234-5678
                </a>
                <span className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <MapPin size={13} className="text-primary/70 mt-0.5" /> Buenos Aires, Argentina
                </span>
              </div>
            </div>

            <div className="lg:col-span-4">
              <h4 className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70 mb-5">Soluciones</h4>
              <ul className="space-y-2.5">
                {footerLinks.soluciones.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h4 className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70 mb-5">Empresa</h4>
              <ul className="space-y-2.5">
                {footerLinks.empresa.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/30 bg-background">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5 text-[11px] text-muted-foreground/70">
            <p>© {new Date().getFullYear()} Bartez Tecnología. Todos los derechos reservados.</p>
            <p>Buenos Aires, Argentina · Partner Tecnológico Corporativo</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
