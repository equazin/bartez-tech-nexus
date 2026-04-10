import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface FeaturedProduct {
  id: number;
  name: string;
  sku: string | null;
  unit_price: number | null;
  image: string | null;
  brand_name: string | null;
  category: string | null;
}

export default function FeaturedProducts() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, sku, unit_price, image, brand_name, category")
      .eq("active", true)
      .eq("featured", true)
      .limit(6)
      .then(({ data }) => { if (data) setProducts(data as FeaturedProduct[]); });
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary mb-3">
              <Star size={10} /> Productos Destacados
            </span>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground">
              Equipamiento <span className="text-gradient">recomendado</span>
            </h2>
          </div>
          <Link to="/login">
            <Button variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-9 px-4 text-xs hidden md:flex">
              Ver catálogo completo <ArrowRight size={12} className="ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(p => (
            <div key={p.id} className="card-enterprise group rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-secondary/40 flex items-center justify-center overflow-hidden">
                {p.image ? (
                  <img
                    src={p.image}
                    alt={p.name}
                    className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="text-muted-foreground/20 text-4xl font-bold font-display select-none">
                    {p.brand_name?.slice(0, 2).toUpperCase() ?? "—"}
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                {(p.brand_name || p.category) && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">
                    {p.brand_name}{p.brand_name && p.category ? " · " : ""}{p.category}
                  </p>
                )}
                <h3 className="text-sm font-semibold text-foreground leading-snug flex-1 mb-3">{p.name}</h3>
                <Link to="/login" className="mt-auto">
                  <Button className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-9 text-xs">
                    Consultar precio <ArrowRight size={12} className="ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link to="/login">
            <Button variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-9 px-6 text-xs">
              Ver catálogo completo <ArrowRight size={12} className="ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
