import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  MessageCircle,
  MonitorCheck,
  Package,
  Printer,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Users,
} from "lucide-react";

import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyContext";
import {
  fetchPublicPosCatalog,
  type PublicPosCatalog,
  type PublicPosKit,
  type PublicPosProduct,
} from "@/lib/api/posProductsApi";

const WHATSAPP_NUMBER = "5493415104902";

function formatUsd(value: number): string {
  return `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("impres")) return Printer;
  if (normalized.includes("lector")) return ScanLine;
  if (normalized.includes("terminal")) return Store;
  return Package;
}

function buildWhatsappUrl(
  title: string,
  lines: string[],
  priceLabel: string,
  usdLabel: string,
  customMessage?: string | null,
): string {
  const message = customMessage?.trim() || [
    `Hola, quiero consultar/comprar ${title}.`,
    "",
    ...lines,
    "",
    `Precio publicado: ${priceLabel} (${usdLabel})`,
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function KitCard({ kit, formatARS }: { kit: PublicPosKit; formatARS: (value: number, from?: "USD" | "ARS") => string }) {
  const priceArs = formatARS(kit.priceUsd, "USD");
  const priceUsd = formatUsd(kit.priceUsd);
  const whatsappUrl = buildWhatsappUrl(
    `el kit ${kit.name}`,
    [
      ...kit.items.map((item) => `- ${item.sku ?? "SKU s/d"} | ${item.name} x${item.quantity}`),
      ...(kit.barposIncluded ? ["- BARpos incluido"] : []),
    ],
    priceArs,
    priceUsd,
    kit.whatsappMessage,
  );

  return (
    <article className="card-enterprise flex h-full flex-col rounded-2xl p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        {kit.image ? (
          <img src={kit.image} alt="" className="h-16 w-16 rounded-xl border border-border/70 object-cover" />
        ) : (
          <div className="icon-container h-11 w-11 text-primary">
            <ShoppingCart size={19} />
          </div>
        )}
        <div className="flex flex-col items-end gap-2">
          {kit.badge && (
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              {kit.badge}
            </span>
          )}
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            {kit.stock > 0 ? `${kit.stock} kits` : "Consultar stock"}
          </span>
        </div>
      </div>

      <h3 className="font-display text-xl font-bold text-foreground">{kit.name}</h3>
      <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-muted-foreground">{kit.description}</p>

      <div className="mt-5 space-y-2 rounded-xl border border-border/60 bg-background/45 p-3">
        {kit.items.map((item) => (
          <div key={`${kit.id}-${item.sku ?? item.name}`} className="flex items-start gap-2 text-xs">
            <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-semibold text-foreground">{item.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {item.sku ?? "SKU s/d"} - {item.category} x{item.quantity}
              </p>
            </div>
          </div>
        ))}
        {kit.barposIncluded && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/10 px-2 py-2 text-xs">
            <MonitorCheck size={13} className="mt-0.5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold text-foreground">BARpos incluido</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Sistema de venta para caja, stock y reportes.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Precio lista</p>
        <div className="mt-1 text-3xl font-extrabold leading-none text-primary tabular-nums">{priceArs}</div>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{priceUsd} + IVA</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button className="h-10 w-full bg-gradient-primary text-xs font-semibold text-primary-foreground hover:opacity-90">
              <MessageCircle size={14} />
              {kit.ctaLabel || "Comprar"}
            </Button>
          </a>
          <Link to="/registrarse?interest=pos">
            <Button variant="outline" className="h-10 w-full border-border/70 text-xs font-semibold">
              Registrarse
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

function ProductCard({ product, formatARS }: { product: PublicPosProduct; formatARS: (value: number, from?: "USD" | "ARS") => string }) {
  const Icon = getCategoryIcon(product.category);
  const priceArs = formatARS(product.priceUsd, "USD");
  const priceUsd = formatUsd(product.priceUsd);
  const whatsappUrl = buildWhatsappUrl(
    product.name,
    [`- ${product.sku ?? "SKU s/d"} | ${product.name}`],
    priceArs,
    priceUsd,
  );

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex h-36 items-center justify-center bg-secondary/35 p-4">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <Icon size={36} className="text-muted-foreground/35" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            <Icon size={10} />
            {product.category}
          </span>
          {product.stock > 0 ? (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
              {product.stock} u.
            </span>
          ) : (
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
              Consultar
            </span>
          )}
        </div>

        {product.brand && (
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{product.brand}</p>
        )}
        <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-foreground">{product.name}</h3>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{product.sku ?? "SKU s/d"}</p>

        <div className="mt-auto pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Precio lista</p>
          <div className="mt-1 text-xl font-extrabold text-primary tabular-nums">{priceArs}</div>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{priceUsd} + IVA</p>

          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
            <Button variant="outline" className="h-9 w-full border-border/70 text-xs font-semibold">
              <MessageCircle size={13} />
              Consultar
            </Button>
          </a>
        </div>
      </div>
    </article>
  );
}

export default function PointOfSale() {
  const { formatARS } = useCurrency();
  const [catalog, setCatalog] = useState<PublicPosCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPublicPosCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar Punto de Venta.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const values = new Set(catalog?.products.map((product) => product.category) ?? []);
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es-AR"));
  }, [catalog]);

  const visibleProducts = useMemo(() => {
    const products = catalog?.products ?? [];
    if (activeCategory === "all") return products;
    return products.filter((product) => product.category === activeCategory);
  }, [activeCategory, catalog]);

  const heroKit = catalog?.kits[0];
  const heroPrice = heroKit ? formatARS(heroKit.priceUsd, "USD") : null;

  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border/50 bg-background py-14 lg:py-20">
        <div className="absolute inset-0 hero-radial opacity-70" />
        <div className="relative container mx-auto grid gap-10 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
              Punto de Venta para comercios que necesitan vender sin friccion
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Kits POS, impresoras termicas, lectores de codigo y BARpos, nuestro sistema de venta para comercios de alta rotacion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#kits-pos">
                <Button className="h-11 bg-gradient-primary px-6 font-semibold text-primary-foreground hover:opacity-90">
                  Ver kits POS <ArrowRight size={15} />
                </Button>
              </a>
              <Link to="/registrarse?interest=pos">
                <Button variant="outline" className="h-11 border-border/70 px-6 font-semibold">
                  Registrarse
                </Button>
              </Link>
            </div>
          </div>

          <div className="card-enterprise rounded-2xl p-5 lg:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="icon-container h-12 w-12 text-primary">
                <Store size={21} />
              </div>
              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Precio publico
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Kits listos para implementar</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Publicamos combos armados manualmente para caja, mostrador y deposito.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/55 p-3">
                <Printer size={17} className="text-primary" />
                <p className="mt-2 text-xs font-bold text-foreground">Tickets y etiquetas</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/55 p-3">
                <ScanLine size={17} className="text-primary" />
                <p className="mt-2 text-xs font-bold text-foreground">Codigos 1D/2D</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/55 p-3">
                <ShieldCheck size={17} className="text-primary" />
                <p className="mt-2 text-xs font-bold text-foreground">Garantia oficial</p>
              </div>
            </div>
            {heroPrice && (
              <div className="mt-6 rounded-xl border border-primary/20 bg-primary/8 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Desde</p>
                <p className="mt-1 text-3xl font-extrabold text-foreground tabular-nums">{heroPrice}</p>
                <p className="mt-1 text-xs text-muted-foreground">Kit {heroKit?.name} + IVA</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-border/50 bg-surface py-14 lg:py-18">
        <div className="container mx-auto grid gap-8 px-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
          <div>
            <span className="enterprise-badge mb-4 inline-flex">BARpos</span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Sistema de venta completo para kioscos, chinos y minisuper
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              BARpos acompaña los kits de hardware con caja rapida, control de stock, lectura por codigo,
              reportes y operacion diaria pensada para maxikioscos, autoservicios, almacenes y comercios de alta rotacion.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola, quiero conocer BARpos para mi comercio.")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="h-11 bg-gradient-primary px-6 font-semibold text-primary-foreground hover:opacity-90">
                  <MessageCircle size={15} />
                  Consultar BARpos
                </Button>
              </a>
              <a href="#kits-pos">
                <Button variant="outline" className="h-11 border-border/70 px-6 font-semibold">
                  Ver hardware compatible
                </Button>
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: MonitorCheck, title: "Caja rapida", text: "Venta por codigo, tickets y flujo simple para mostrador." },
              { icon: Package, title: "Stock y precios", text: "Control de inventario, reposicion y cambios de precio." },
              { icon: BarChart3, title: "Reportes", text: "Lectura clara de ventas, productos y movimientos diarios." },
              { icon: Users, title: "Multi-rubro", text: "Adaptado para kioscos, chinos, maxikioscos y minisuper." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-4">
                <Icon size={19} className="text-primary" />
                <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="kits-pos" className="py-16 lg:py-24">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Opciones POS"
            title="Kits para caja,"
            highlight="stock y mostrador"
            description="Combos cargados manualmente con precio propio, independientes del catalogo B2B. Si necesita otro armado, lo resolvemos por WhatsApp."
          />

          {loading ? (
            <div className="grid gap-5 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
              {error}
            </div>
          ) : catalog && catalog.kits.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-3">
              {catalog.kits.map((kit) => (
                <KitCard key={kit.id} kit={kit} formatARS={formatARS} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No hay kits completos disponibles. Consulte los productos individuales o escribanos por WhatsApp.
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-border/50 bg-surface py-16 lg:py-24">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="enterprise-badge mb-4 inline-flex">Productos POS</span>
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Opciones con precio publicado
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Terminales POS, impresoras termicas y lectores de codigo disponibles para comprar o cotizar.
              </p>
            </div>
            {!loading && catalog && (
              <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm">
                <span className="font-bold text-foreground">{catalog.meta.count}</span>
                <span className="ml-1 text-muted-foreground">productos POS activos</span>
              </div>
            )}
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${
                activeCategory === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            {categories.map((category) => {
              const Icon = getCategoryIcon(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition ${
                    activeCategory === category
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={13} />
                  {category}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} formatARS={formatARS} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
              <Tag size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No hay productos disponibles para esta categoria.</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="card-enterprise flex flex-col items-start justify-between gap-5 rounded-2xl p-7 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">Necesita armar otra solucion POS?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Enviamos alternativas por presupuesto, sucursales, rubro y volumen. Tambien puede registrarse para ver el catalogo B2B completo.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hola, quiero armar una solucion de Punto de Venta para mi comercio.")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="h-11 w-full bg-gradient-primary px-6 font-semibold text-primary-foreground hover:opacity-90 sm:w-auto">
                  <MessageCircle size={15} />
                  Hablar por WhatsApp
                </Button>
              </a>
              <Link to="/registrarse?interest=pos">
                <Button variant="outline" className="h-11 w-full border-border/70 px-6 font-semibold sm:w-auto">
                  Solicitar cuenta B2B
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
