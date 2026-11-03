import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import { listarCategorias, listarDestacados, type CategoriaPublica, type ProductoPublico } from "@/lib/tienda/catalogo";
import { useSeo } from "@/lib/tienda/seo";

const CONFIANZA = [
  {
    icono: Truck,
    titulo: "Envío a todo el país",
    texto: "El mismo precio y el mismo plazo en cualquier provincia, a tu domicilio.",
  },
  {
    icono: ShieldCheck,
    titulo: "Precio final, sin sorpresas",
    texto: "Todos los precios incluyen IVA. Pagás de contado o en cuotas.",
  },
  {
    icono: RotateCcw,
    titulo: "Arrepentimiento sin vueltas",
    texto: "Podés revocar la compra dentro de los 10 días corridos de recibirla, sin registro.",
  },
];

function buscarPorNombre(categorias: CategoriaPublica[], patron: RegExp): CategoriaPublica | undefined {
  return categorias.find((c) => patron.test(c.nombre) || patron.test(c.slug));
}

export default function Inicio() {
  useSeo("Notebooks, gaming, monitores y periféricos", "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.");

  const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);
  const [destacados, setDestacados] = useState<ProductoPublico[]>([]);
  const [cargandoDestacados, setCargandoDestacados] = useState(true);

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setCategorias(lista.filter((c) => c.cantidad > 0));
      })
      .catch(() => {
        if (!cancelado) setCategorias([]);
      });
    listarDestacados(8)
      .then((lista) => {
        if (!cancelado) setDestacados(lista);
      })
      .catch(() => {
        if (!cancelado) setDestacados([]);
      })
      .finally(() => {
        if (!cancelado) setCargandoDestacados(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const notebooks = buscarPorNombre(categorias, /notebook|portátil|laptop/i);
  const gaming = buscarPorNombre(categorias, /gaming|gamer/i);
  const destino = notebooks ?? categorias[0];

  return (
    <Tienda>
      {/* Portada */}
      <section className="relative overflow-hidden bg-background">
        <img src="/portada/portada.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" aria-hidden />
        <div className="container relative mx-auto flex min-h-[520px] flex-col justify-center gap-6 px-4 py-16 lg:min-h-[620px]">
          <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Tecnología para trabajar, crear y jugar</p>
          <h1 className="max-w-3xl font-display text-5xl font-bold uppercase leading-[0.97] tracking-[0.5px] md:text-[64px]">Subí tu mundo.</h1>
          <p className="max-w-xl text-lg leading-7 text-muted-foreground">
            Notebooks, gaming, monitores y periféricos con envío a todo el país y precios finales con IVA incluido.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={destino ? `/${destino.slug}` : "/buscar"}>{destino ? `Ver ${destino.nombre.toLowerCase()}` : "Ver el catálogo"}</Link>
            </Button>
            {gaming && (
              <Button asChild size="lg" variant="outline">
                <Link to={`/${gaming.slug}`}>Gaming</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Categorías */}
      {categorias.length > 0 && (
        <section className="container mx-auto px-4 py-12 lg:py-16">
          <h2 className="mb-6 text-[28px] font-bold leading-[34px] tracking-[-0.5px]">Qué estás buscando</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {categorias.map((categoria) => (
              <li key={categoria.id}>
                <Link
                  to={`/${categoria.slug}`}
                  className="flex h-full items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-bold">{categoria.nombre}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{categoria.cantidad}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Destacados */}
      {(cargandoDestacados || destacados.length > 0) && (
        <section className="container mx-auto px-4 py-12 lg:py-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">Destacados</h2>
            {destino && (
              <Link to={`/${destino.slug}`} className="inline-flex items-center gap-1 text-sm font-bold hover:underline">
                Ver todo <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          <GrillaProductos productos={destacados} cargando={cargandoDestacados} />
        </section>
      )}

      {/* Gaming */}
      {gaming && (
        <section className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-start gap-5 rounded-2xl bg-secondary p-8 md:flex-row md:items-center md:justify-between lg:p-12">
            <div className="space-y-2">
              <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Gaming</p>
              <h2 className="font-display text-4xl font-bold uppercase leading-none tracking-[0.5px] text-primary md:text-5xl">Más FPS. Menos excusas.</h2>
              <p className="text-muted-foreground">Notebooks y periféricos para jugar en serio, con configuración de fábrica.</p>
            </div>
            <Button asChild size="lg">
              <Link to={`/${gaming.slug}`}>Ver gaming</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Confianza */}
      <section className="container mx-auto px-4 py-12 lg:py-16">
        <ul className="grid gap-4 md:grid-cols-3">
          {CONFIANZA.map(({ icono: Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
              <Icono className="h-6 w-6 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="font-bold">{titulo}</p>
                <p className="text-sm leading-5 text-muted-foreground">{texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Tienda>
  );
}
