import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import { BloqueDeProductos } from "@/components/tienda/inicio/BloqueDeProductos";
import { ElegidoDeLaSemana } from "@/components/tienda/inicio/ElegidoDeLaSemana";
import { FranjaDeConfianza } from "@/components/tienda/inicio/FranjaDeConfianza";
import { Marcas } from "@/components/tienda/inicio/Marcas";
import { MasVendidos } from "@/components/tienda/inicio/MasVendidos";
import { QueEstasBuscando } from "@/components/tienda/inicio/QueEstasBuscando";
import { listarCategorias, listarNuevosIngresos, listarOfertas, type CategoriaPublica, type ProductoPublico } from "@/lib/tienda/catalogo";
import {
  listarMarcas,
  obtenerMasVendidos,
  obtenerPortada,
  type MarcaPublica,
  type MasVendidos as DatosMasVendidos,
  type Portada,
} from "@/lib/tienda/portada";
import { useSeo } from "@/lib/tienda/seo";

const PORTADA_INICIAL: Portada = { elegido: null, garantia_meses: null, cuotas_maximas: null };

function buscarPorNombre(categorias: CategoriaPublica[], patron: RegExp): CategoriaPublica | undefined {
  return categorias.find((c) => patron.test(c.nombre) || patron.test(c.slug));
}

/** Carga una lista para la portada; si falla, el bloque no aparece en lugar de romper la página. */
function useCarga<T>(cargar: () => Promise<T>, vacio: T): { valor: T; cargando: boolean } {
  const [estado, setEstado] = useState<{ valor: T; cargando: boolean }>({ valor: vacio, cargando: true });
  useEffect(() => {
    let cancelado = false;
    cargar()
      .then((valor) => {
        if (!cancelado) setEstado({ valor, cargando: false });
      })
      .catch(() => {
        if (!cancelado) setEstado({ valor: vacio, cargando: false });
      });
    return () => {
      cancelado = true;
    };
    // Cada bloque se carga una vez por visita a la portada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return estado;
}

const SIN_PRODUCTOS: ProductoPublico[] = [];
const SIN_MARCAS: MarcaPublica[] = [];
const SIN_CATEGORIAS: CategoriaPublica[] = [];

/**
 * La portada, bloque por bloque según docs/plan-pagina-y-contenido.md (sección 3): portada,
 * qué estás buscando, elegido de la semana, lo más vendido, ofertas, gaming, franja de
 * confianza, nuevos ingresos y marcas. Los bloques sin datos no se muestran.
 */
export default function Inicio() {
  useSeo("Notebooks, gaming, monitores y periféricos", "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.");

  const { valor: raices } = useCarga(listarCategorias, SIN_CATEGORIAS);
  const { valor: portada } = useCarga(obtenerPortada, PORTADA_INICIAL);
  const masVendidos = useCarga<DatosMasVendidos | null>(() => obtenerMasVendidos(24), null);
  const ofertas = useCarga(() => listarOfertas(8), SIN_PRODUCTOS);
  const nuevos = useCarga(() => listarNuevosIngresos(8), SIN_PRODUCTOS);
  const { valor: marcas } = useCarga(listarMarcas, SIN_MARCAS);

  const categorias = raices.filter((c) => c.cantidad > 0);
  const notebooks = buscarPorNombre(categorias, /notebook|portátil|laptop/i);
  const gaming = buscarPorNombre(categorias, /gaming|gamer/i);
  const destino = notebooks ?? categorias[0];

  return (
    <Tienda>
      {/* 1 · Portada */}
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
                <Link to={`/${gaming.slug}`}>Ver gaming</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2 · Qué estás buscando */}
      <QueEstasBuscando raices={raices} />

      {/* 3 · Elegido de la semana */}
      {portada.elegido && <ElegidoDeLaSemana elegido={portada.elegido} />}

      {/* 4 · Lo más vendido (o destacados, mientras no haya ventas) */}
      <MasVendidos datos={masVendidos.valor} cargando={masVendidos.cargando} verTodo={destino ? `/${destino.slug}` : undefined} />

      {/* 5 · Ofertas */}
      {ofertas.valor.length > 0 && (
        <BloqueDeProductos id="ofertas" titulo="Ofertas" bajada="Precio final rebajado sobre el de lista, con IVA incluido." verTodo={{ ruta: "/ofertas", etiqueta: "Ver todas" }}>
          <GrillaProductos productos={ofertas.valor} />
        </BloqueDeProductos>
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

      {/* 7 · Franja de confianza */}
      <FranjaDeConfianza portada={portada} />

      {/* 8 · Nuevos ingresos */}
      {nuevos.valor.length > 0 && (
        <BloqueDeProductos id="nuevos" titulo="Nuevos ingresos" bajada="Lo último que entró al catálogo." verTodo={{ ruta: "/nuevos-ingresos" }}>
          <GrillaProductos productos={nuevos.valor} />
        </BloqueDeProductos>
      )}

      {/* 9 · Marcas */}
      <Marcas marcas={marcas} />
    </Tienda>
  );
}
