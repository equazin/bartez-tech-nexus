import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, ChevronDown, Server, Network, Monitor, Wrench, Shield, Headphones, Building2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const solucionesLinks = [
  { label: "Soluciones Corporativas", href: "/soluciones-corporativas", icon: Building2, desc: "Infraestructura, redes y equipamiento" },
  { label: "Tecnología", href: "/tecnologia", icon: Monitor, desc: "Catálogo de productos" },
  { label: "Industrias", href: "/soluciones-por-industria", icon: Globe, desc: "Soluciones por sector" },
  { label: "Partnership B2B", href: "/partnership", icon: Wrench, desc: "Provisión mayorista e integradores" },
];

const serviciosLinks = [
  { label: "Servicios IT", href: "/servicios-it", icon: Server, desc: "Consultoría, soporte y gestión" },
  { label: "Ciberseguridad", href: "/servicios-it", icon: Shield, desc: "Protección y continuidad operativa" },
  { label: "Soporte Continuo", href: "/servicios-it", icon: Headphones, desc: "Mesa de ayuda con SLA garantizado" },
  { label: "Redes Corporativas", href: "/soluciones-corporativas", icon: Network, desc: "LAN/WAN, WiFi, VPN" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solucionesOpen, setSolucionesOpen] = useState(false);
  const [serviciosOpen, setServiciosOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const solucionesRef = useRef<HTMLDivElement>(null);
  const serviciosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSolucionesOpen(false);
    setServiciosOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (solucionesRef.current && !solucionesRef.current.contains(e.target as Node)) {
        setSolucionesOpen(false);
      }
      if (serviciosRef.current && !serviciosRef.current.contains(e.target as Node)) {
        setServiciosOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const dropdownVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15 } },
    exit: { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.1 } },
  };

  const isSolucionesActive = solucionesLinks.some(l => location.pathname === l.href);
  const isServiciosActive = serviciosLinks.some(l => location.pathname === l.href);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top utility bar */}
      <div className="hidden lg:block border-b border-border/20 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 lg:px-8 h-8">
          <span className="text-[11px] text-muted-foreground">
            Departamento IT externo para empresas · 15+ años de experiencia
          </span>
          <div className="flex items-center gap-5">
            <a
              href="https://wa.me/5493415104902"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone size={10} />
              +54 9 341 510-4902
            </a>
            <span className="text-[11px] text-muted-foreground">Lun-Vie 9:00 – 16:00</span>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav
        className={`transition-all duration-300 ${
          scrolled
            ? "bg-glass-strong border-b border-border/30 shadow-lg shadow-background/50"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
              <img src="/icon.png" alt="Bartez" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-tight text-foreground leading-none">BARTEZ</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground leading-none mt-0.5">Tecnología</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-0.5 lg:flex">

            {/* Soluciones dropdown */}
            <div ref={solucionesRef} className="relative">
              <button
                onClick={() => { setSolucionesOpen(!solucionesOpen); setServiciosOpen(false); }}
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isSolucionesActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Soluciones
                <ChevronDown size={13} className={`transition-transform duration-200 ${solucionesOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {solucionesOpen && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute left-0 top-full mt-1 w-72 rounded-xl bg-glass-strong border border-border/40 shadow-xl overflow-hidden"
                  >
                    {solucionesLinks.map((link) => (
                      <Link
                        key={link.href + link.label}
                        to={link.href}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors group/item"
                      >
                        <div className="icon-container h-8 w-8 shrink-0 text-primary mt-0.5">
                          <link.icon size={14} />
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-foreground group-hover/item:text-primary transition-colors">{link.label}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{link.desc}</span>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Servicios IT dropdown */}
            <div ref={serviciosRef} className="relative">
              <button
                onClick={() => { setServiciosOpen(!serviciosOpen); setSolucionesOpen(false); }}
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isServiciosActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Servicios IT
                <ChevronDown size={13} className={`transition-transform duration-200 ${serviciosOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {serviciosOpen && (
                  <motion.div
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute left-0 top-full mt-1 w-72 rounded-xl bg-glass-strong border border-border/40 shadow-xl overflow-hidden"
                  >
                    {serviciosLinks.map((link) => (
                      <Link
                        key={link.href + link.label}
                        to={link.href}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors group/item"
                      >
                        <div className="icon-container h-8 w-8 shrink-0 text-primary mt-0.5">
                          <link.icon size={14} />
                        </div>
                        <div>
                          <span className="block text-sm font-medium text-foreground group-hover/item:text-primary transition-colors">{link.label}</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">{link.desc}</span>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Links directos */}
            {[
              { label: "Nosotros", href: "/nosotros" },
              { label: "Contacto", href: "/contacto" },
            ].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`relative rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  location.pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
                {location.pathname === link.href && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </Link>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login">
              <Button size="sm" variant="outline" className="font-semibold text-foreground hover:bg-secondary/80 h-9 px-4 text-[13px]">
                Portal Clientes
              </Button>
            </Link>
            <Link to="/evaluacion-tecnologica">
              <Button size="sm" className="bg-gradient-primary btn-interactive font-semibold text-primary-foreground hover:opacity-90 glow-sm h-9 px-5 text-[13px]">
                Solicitar Evaluación
              </Button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden text-foreground p-2 rounded-lg hover:bg-secondary transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/30 bg-glass-strong lg:hidden overflow-hidden"
          >
            <div className="container mx-auto flex flex-col gap-1 px-4 py-4">
              <span className="px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Soluciones</span>
              {solucionesLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    location.pathname === link.href
                      ? "text-foreground bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              <div className="border-t border-border/30 mt-2 pt-2">
                <span className="px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Servicios IT</span>
                {serviciosLinks.slice(0, 2).map((link) => (
                  <Link
                    key={link.href + link.label}
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="border-t border-border/30 mt-2 pt-2">
                {[
                  { label: "Nosotros", href: "/nosotros" },
                  { label: "Contacto", href: "/contacto" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button className="mt-2 w-full border border-border/40 bg-background/60 font-semibold text-foreground hover:bg-secondary h-11">
                  Portal Clientes
                </Button>
              </Link>
              <Link to="/evaluacion-tecnologica" onClick={() => setMobileOpen(false)}>
                <Button className="mt-2 w-full bg-gradient-primary font-semibold text-primary-foreground h-11">
                  Solicitar Evaluación
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
