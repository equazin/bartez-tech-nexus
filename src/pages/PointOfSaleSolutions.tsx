import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeDollarSign,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Headphones,
  Monitor,
  PackageCheck,
  Printer,
  ReceiptText,
  ScanBarcode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import { trackCTAClick } from "@/lib/marketingTracker";

const POS_WHATSAPP_URL =
  "https://wa.me/5493415104902?text=Hola%2C%20quiero%20cotizar%20un%20punto%20de%20venta%20completo%20para%20mi%20kiosco%20o%20minisuper.%20Necesito%20equipos%20y%20sistema%20listos%20para%20empezar.";

const audiences = [
  { icon: Store, title: "Kioscos", desc: "Venta rápida, control de caja y lectura de códigos para operar sin demoras." },
  { icon: ShoppingCart, title: "Minisúper", desc: "Múltiples rubros, precios actualizados e inventario listo para crecer." },
  { icon: Boxes, title: "Almacenes", desc: "Equipos compactos y sistema simple para ordenar stock, ventas y tickets." },
  { icon: ReceiptText, title: "Retail chico", desc: "Puestos de venta configurados para comercios, franquicias y locales." },
];

const includedItems = [
  { icon: Monitor, title: "Terminal o PC", desc: "Equipo dimensionado para caja, facturación, sistema POS y periféricos." },
  { icon: PackageCheck, title: "Monitor o táctil", desc: "Pantalla de operación para mostrador, con opción táctil según el flujo." },
  { icon: Printer, title: "Impresora térmica", desc: "Tickets rápidos y confiables para venta diaria de alto movimiento." },
  { icon: ScanBarcode, title: "Lector de códigos", desc: "Agiliza la carga de productos y reduce errores en mostrador." },
  { icon: BadgeDollarSign, title: "Cajón de dinero", desc: "Apertura ordenada y compatible con el puesto de venta." },
  { icon: Wrench, title: "Sistema configurado", desc: "Puesta en marcha, parámetros iniciales y soporte para empezar a usarlo." },
];

const kitOptions = [
  {
    name: "Kiosco Esencial",
    eyebrow: "1 caja",
    desc: "Para locales chicos que necesitan vender, emitir ticket y controlar caja sin sumar complejidad.",
    items: ["PC o terminal compacta", "Impresora térmica", "Lector de códigos", "Sistema POS configurado"],
  },
  {
    name: "Minisúper Completo",
    eyebrow: "Mostrador + stock",
    desc: "Para comercios con mayor rotación, múltiples categorías y necesidad de control diario.",
    items: ["Terminal principal", "Monitor o táctil", "Cajón de dinero", "Inventario y precios iniciales"],
  },
  {
    name: "Retail Multi-caja",
    eyebrow: "Escalable",
    desc: "Para operaciones con más de una caja, sucursales o crecimiento planificado.",
    items: ["Equipos por puesto", "Red y periféricos", "Configuración por usuarios", "Soporte de implementación"],
  },
];

const processSteps = [
  { icon: ClipboardCheck, title: "Relevamiento", desc: "Entendemos rubro, cantidad de cajas, productos, facturación y forma de trabajo." },
  { icon: PackageCheck, title: "Armado del kit", desc: "Definimos el equipamiento justo para el mostrador y el volumen de venta." },
  { icon: Settings, title: "Configuración", desc: "Preparamos equipo, periféricos y sistema para que llegue listo para operar." },
  { icon: Headphones, title: "Puesta en marcha", desc: "Acompañamos el arranque y dejamos soporte para las primeras consultas." },
];

const PointOfSaleSolutions = () => {
  return (
    <Layout>
      <section className="page-hero overflow-hidden">
        <div className="absolute inset-0 hero-radial" />
        <div className="absolute inset-0 hero-grid opacity-10" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Puntos de Venta"
            title="Puntos de venta listos para vender"
            highlight="desde el primer día"
            description="Equipos completos, sistema POS, periféricos y configuración inicial para kioscos, minisúper, almacenes y comercios que necesitan empezar a operar sin vueltas."
            large
          />
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-gradient-primary font-bold text-primary-foreground hover:opacity-90 glow-sm h-12 px-8 text-sm"
              onClick={() => trackCTAClick("pos_page_whatsapp_quote")}
            >
              <a href={POS_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                Cotizar por WhatsApp <ArrowRight size={16} className="ml-2" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-sm">
              <a href="#kits-pos">
                Ver kits sugeridos
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="pb-20 lg:pb-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {audiences.map((audience, i) => (
              <motion.div
                key={audience.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="card-enterprise rounded-xl p-6"
              >
                <div className="icon-container h-11 w-11 text-primary mb-4">
                  <audience.icon size={20} />
                </div>
                <h3 className="font-display text-base font-bold text-foreground">{audience.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{audience.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="lg:sticky lg:top-32">
                <SectionHeading
                  badge="Llave en mano"
                  title="Todo lo necesario para"
                  highlight="abrir caja"
                  description="No vendemos piezas sueltas como una lista técnica. Armamos el puesto completo para que el comercio pueda cobrar, imprimir, leer productos y controlar la operación diaria."
                  center={false}
                />
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={20} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-sm text-secondary-foreground leading-relaxed">
                      Incluye asesoramiento para elegir el kit correcto, configuración inicial y soporte de arranque para reducir errores el primer día.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {includedItems.map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ delay: i * 0.06, duration: 0.45 }}
                    className="card-enterprise rounded-xl p-6"
                  >
                    <div className="icon-container h-10 w-10 text-primary mb-4">
                      <item.icon size={18} />
                    </div>
                    <h3 className="font-display text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      <section id="kits-pos" className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Kits sugeridos"
            title="Soluciones preparadas para"
            highlight="cada tipo de comercio"
            description="Partimos de configuraciones probadas y las ajustamos según rubro, cantidad de productos, espacio de mostrador y forma de facturación."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {kitOptions.map((kit, i) => (
              <motion.div
                key={kit.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="card-enterprise flex h-full flex-col rounded-2xl p-7"
              >
                <span className="mb-4 inline-flex w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                  {kit.eyebrow}
                </span>
                <h3 className="font-display text-xl font-bold text-foreground">{kit.name}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{kit.desc}</p>
                <ul className="mt-6 space-y-3">
                  {kit.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-secondary-foreground">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <div className="container mx-auto px-4 lg:px-8">
            <SectionHeading
              badge="Implementación"
              title="De la consulta a la caja"
              highlight="operando"
              description="Un flujo simple para que el comercio sepa qué comprar, cómo instalarlo y cómo empezar a usarlo."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="card-enterprise rounded-xl p-6"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="icon-container h-10 w-10 text-primary">
                      <step.icon size={18} />
                    </div>
                    <span className="font-display text-2xl font-extrabold text-border/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-10 text-center md:p-14 lg:p-20"
          >
            <div className="absolute inset-0 hero-grid opacity-10 pointer-events-none" />
            <div
              className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(ellipse, hsl(var(--primary) / 0.06), transparent 70%)" }}
            />
            <div className="relative">
              <span className="enterprise-badge mb-6 inline-flex">
                <Barcode size={12} />
                Cotización POS
              </span>
              <h2 className="font-display text-2xl font-bold leading-[1.1] tracking-tight text-foreground md:text-3xl lg:text-4xl">
                Contanos qué comercio tenés y armamos
                <br className="hidden sm:block" />
                <span className="text-gradient"> el punto de venta completo</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
                Te orientamos con el kit adecuado para tu mostrador, cantidad de productos, forma de cobro y ritmo de ventas.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-11 px-7 text-sm"
                  onClick={() => trackCTAClick("pos_page_whatsapp_quote")}
                >
                  <a href={POS_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    Cotizar por WhatsApp <ArrowRight size={14} className="ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default PointOfSaleSolutions;
