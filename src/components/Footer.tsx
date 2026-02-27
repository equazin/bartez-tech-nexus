import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-surface">
      <div className="container mx-auto px-4 py-16 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
                <span className="font-display text-lg font-bold text-primary-foreground">B</span>
              </div>
              <span className="font-display text-lg font-semibold text-foreground">
                Bartez Tecnología
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Soluciones tecnológicas corporativas para empresas que buscan rendimiento, confiabilidad y escalabilidad.
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Productos</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/productos" className="hover:text-primary transition-colors">Desktop PCs</Link></li>
              <li><Link to="/productos" className="hover:text-primary transition-colors">Notebooks</Link></li>
              <li><Link to="/productos" className="hover:text-primary transition-colors">Gaming PCs</Link></li>
              <li><Link to="/productos" className="hover:text-primary transition-colors">Servidores</Link></li>
              <li><Link to="/productos" className="hover:text-primary transition-colors">Networking</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Servicios</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li><Link to="/soluciones-corporativas" className="hover:text-primary transition-colors">Soluciones Corporativas</Link></li>
              <li><Link to="/servicios-it" className="hover:text-primary transition-colors">Servicios IT</Link></li>
              <li><Link to="/empresas" className="hover:text-primary transition-colors">Soluciones B2B</Link></li>
              <li><Link to="/cotizacion" className="hover:text-primary transition-colors">Cotización</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-primary" />
                <span>info@barteztecnologia.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-primary" />
                <span>+54 11 1234-5678</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-primary mt-0.5" />
                <span>Buenos Aires, Argentina</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Bartez Tecnología. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
