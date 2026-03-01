import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, ArrowRight, Linkedin, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";

const footerLinks = {
  productos: [
    { label: "Desktop PCs", href: "/productos" },
    { label: "Notebooks", href: "/productos" },
    { label: "Gaming PCs", href: "/productos" },
    { label: "Servidores", href: "/productos" },
    { label: "Networking", href: "/productos" },
    { label: "Componentes", href: "/productos" },
  ],
  servicios: [
    { label: "Soluciones Corporativas", href: "/soluciones-corporativas" },
    { label: "Servicios IT", href: "/servicios-it" },
    { label: "Soluciones B2B", href: "/empresas" },
    { label: "Consultoría", href: "/servicios-it" },
    { label: "Cotización", href: "/cotizacion" },
  ],
  empresa: [
    { label: "Sobre Nosotros", href: "/nosotros" },
    { label: "Contacto", href: "/contacto" },
    { label: "Solicitar Cotización", href: "/cotizacion" },
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
                ¿Listo para potenciar su <span className="text-gradient">infraestructura?</span>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-lg">
                Conéctese con nuestro equipo comercial y reciba una propuesta personalizada en 24 horas.
              </p>
            </div>
            <Link to="/cotizacion" className="shrink-0">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-12 px-8 text-sm">
                Solicitar Cotización <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="section-divider" />

      {/* Main footer */}
      <div className="bg-background">
        <div className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
            {/* Brand */}
            <div className="lg:col-span-4">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                  <span className="font-display text-sm font-bold text-primary-foreground">B</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-sm font-bold tracking-tight text-foreground leading-none">
                    BARTEZ
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground leading-none mt-0.5">
                    Tecnología
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Soluciones tecnológicas corporativas para empresas que buscan rendimiento, confiabilidad y escalabilidad. Partner autorizado de las principales marcas globales.
              </p>
              <div className="mt-6 space-y-2.5">
                <a href="mailto:info@barteztecnologia.com" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail size={13} className="text-primary/70" />
                  info@barteztecnologia.com
                </a>
                <a href="tel:+541112345678" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone size={13} className="text-primary/70" />
                  +54 11 1234-5678
                </a>
                <span className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <MapPin size={13} className="text-primary/70 mt-0.5" />
                  Buenos Aires, Argentina
                </span>
              </div>
            </div>

            {/* Products */}
            <div className="lg:col-span-3">
              <h4 className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70 mb-5">Productos</h4>
              <ul className="space-y-2.5">
                {footerLinks.productos.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div className="lg:col-span-3">
              <h4 className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70 mb-5">Servicios</h4>
              <ul className="space-y-2.5">
                {footerLinks.servicios.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div className="lg:col-span-2">
              <h4 className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70 mb-5">Empresa</h4>
              <ul className="space-y-2.5">
                {footerLinks.empresa.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
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