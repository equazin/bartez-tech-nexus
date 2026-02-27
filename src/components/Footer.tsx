import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";

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
      {/* Main footer */}
      <div className="bg-surface">
        <div className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
            {/* Brand */}
            <div className="lg:col-span-4">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
                  <span className="font-display text-base font-bold text-primary-foreground">B</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-base font-bold tracking-tight text-foreground leading-none">
                    BARTEZ
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground leading-none mt-0.5">
                    Tecnología
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Soluciones tecnológicas corporativas para empresas que buscan rendimiento, confiabilidad y escalabilidad.
              </p>
              <div className="mt-6 space-y-3">
                <a href="mailto:info@barteztecnologia.com" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail size={14} className="text-primary" />
                  info@barteztecnologia.com
                </a>
                <a href="tel:+541112345678" className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone size={14} className="text-primary" />
                  +54 11 1234-5678
                </a>
                <span className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <MapPin size={14} className="text-primary mt-0.5" />
                  Buenos Aires, Argentina
                </span>
              </div>
            </div>

            {/* Products */}
            <div className="lg:col-span-3">
              <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-foreground mb-5">Productos</h4>
              <ul className="space-y-3">
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
              <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-foreground mb-5">Servicios</h4>
              <ul className="space-y-3">
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
              <h4 className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-foreground mb-5">Empresa</h4>
              <ul className="space-y-3">
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
      <div className="bg-background">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Bartez Tecnología. Todos los derechos reservados.</p>
            <p>Buenos Aires, Argentina</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
