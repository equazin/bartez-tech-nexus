import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const mainLinks = [
  { label: "Inicio", href: "/" },
  { label: "Soluciones y Equipamiento", href: "/soluciones-corporativas" },
  { label: "Industrias", href: "/soluciones-por-industria" },
  { label: "Servicios IT", href: "/servicios-it" },
  { label: "Soporte", href: "/partnership" },
  { label: "Contacto", href: "/contacto" },
];

const moreLinks = [
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Partnership", href: "/partnership" },
  { label: "Área Clientes", href: "/contacto" },
  { label: "Nosotros", href: "/nosotros" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top utility bar */}
      <div className="hidden lg:block border-b border-border/20 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 lg:px-8 h-8">
          <span className="text-[11px] text-muted-foreground">
            Departamento IT externo para empresas · 15+ años de experiencia
          </span>
          <div className="flex items-center gap-5">
            <a href="https://wa.me/5493415104902" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              <Phone size={10} />
              +54 9 341 510-4902
            </a>
            <span className="text-[11px] text-muted-foreground">Lun-Vie 9:00 – 18:00</span>
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
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary transition-transform group-hover:scale-105">
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
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-0.5 lg:flex">
            {mainLinks.map((link) => (
              <Link
                key={link.href + link.label}
                to={link.href}
                className={`nav-link-hover relative rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
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

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Más <ChevronDown size={13} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-glass-strong border border-border/40 shadow-xl overflow-hidden"
                  >
                    {moreLinks.map((link) => (
                      <Link
                        key={link.href + link.label}
                        to={link.href}
                        className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/evaluacion-tecnologica">
              <Button size="sm" className="bg-gradient-primary btn-interactive font-semibold text-primary-foreground hover:opacity-90 glow-sm h-9 px-5 text-[13px]">
                Solicitar Evaluación Tecnológica
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
              {mainLinks.map((link) => (
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
                <span className="px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">Más</span>
                {moreLinks.map((link) => (
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
              <Link to="/evaluacion-tecnologica" onClick={() => setMobileOpen(false)}>
                <Button className="mt-3 w-full bg-gradient-primary font-semibold text-primary-foreground h-11">
                  Solicitar Evaluación Tecnológica
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
