import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Building2, Lock, Package, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";
import { fetchPublicProducts } from "@/lib/api/productsApi";

interface PublicProduct {
  id: number;
  name: string;
  category: string | null;
  sku: string | null;
  image: string | null;
  active: boolean;
  stock: number;
  brand: string | null;
}

const PAGE_SIZE = 48;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const Products = () => {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void fetchPublicProducts({
      active: true,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
      .then((data) => {
        if (!cancelled) {
          setProducts(data.items);
          setTotal(data.total);
        }
      })
      .catch(() => {/* non-blocking */})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedSearch, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Catálogo Mayorista"
            title="Equipamiento tecnológico para"
            highlight="su empresa"
            description="Navegá nuestro catálogo. Registrate como cliente B2B para ver precios, disponibilidad y condiciones comerciales."
            large
          />
        </div>
      </section>

      {/* Search bar */}
      <section className="py-8 border-b border-border/50">
        <div className="container mx-auto px-4 lg:px-8 max-w-xl">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {!loading && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {total > 0
                ? `${total.toLocaleString()} producto${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`
                : "Sin resultados para esa búsqueda"}
            </p>
          )}
        </div>
      </section>

      {/* Login wall banner */}
      <section className="py-5 bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock size={16} className="text-primary shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">Ver precios y disponibilidad</span> requiere acceso al portal B2B.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Link to="/registrarse">Registrarse</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section className="py-12">
        <div className="container mx-auto px-4 lg:px-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card animate-pulse h-52" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 text-center">
              <Package size={40} className="text-muted-foreground/40" />
              <p className="text-muted-foreground">No se encontraron productos.</p>
              {search && (
                <Button variant="outline" onClick={() => setSearch("")}>Limpiar búsqueda</Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 11) * 0.04, duration: 0.35 }}
                  className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
                >
                  {/* Product image */}
                  <div className="flex h-36 items-center justify-center bg-muted/30 p-4">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Package size={32} className="text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    {product.brand && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {product.brand}
                      </span>
                    )}
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                      {product.name}
                    </p>
                    {product.sku && (
                      <p className="text-[10px] text-muted-foreground/70">SKU: {product.sku}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">{product.category ?? "Sin categoria"}</p>
                  </div>

                  {/* Price lock overlay */}
                  <div className="border-t border-border/60 px-4 py-3">
                    <Link
                      to="/login"
                      className="flex items-center justify-between gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group/lock"
                    >
                      <span className="flex items-center gap-1.5">
                        <Lock size={11} className="shrink-0" />
                        Ver precio
                      </span>
                      <ArrowRight size={11} className="opacity-0 group-hover/lock:opacity-100 transition-opacity" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="pb-24">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card-enterprise rounded-xl p-6 lg:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="icon-container h-12 w-12 text-primary shrink-0">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">¿Necesita equipar su empresa?</h3>
                <p className="text-sm text-muted-foreground">Solicite una evaluación tecnológica y reciba una propuesta integral adaptada a su operación.</p>
              </div>
            </div>
            <Link to="/evaluacion-tecnologica" className="shrink-0">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                Evaluación Tecnológica <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </motion.div>

          <div className="mt-16">
            <EnterpriseCTA
              badge="Provisión Integral"
              badgeIcon={Building2}
              title="¿Necesita equipar múltiples"
              highlight="puestos de trabajo?"
              description="Diseñamos la solución de equipamiento completa para su organización. Desde la evaluación hasta la implementación y soporte continuo."
              primaryLabel="Solicitar Evaluación Tecnológica"
              primaryTo="/evaluacion-tecnologica"
              secondaryLabel="Hablar con un Especialista"
              secondaryTo="/contacto"
              variant="compact"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Products;
