import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan, type Miga } from "@/components/tienda/MigasDePan";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { Galeria } from "@/components/tienda/Galeria";
import { FichaTecnica } from "@/components/tienda/FichaTecnica";
import { Precio } from "@/components/tienda/Precio";
import { EstadoDeStock, agregarYAvisar } from "@/components/tienda/TarjetaProducto";
import { imagenesDe, listarCategorias, obtenerProducto, rutaDeCategoria, type CategoriaPublica, type ProductoPublico } from "@/lib/tienda/catalogo";
import { useSeo } from "@/lib/tienda/seo";

export default function Producto() {
  const { producto: slug = "" } = useParams<{ producto: string }>();
  const [producto, setProducto] = useState<ProductoPublico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raices, setRaices] = useState<CategoriaPublica[]>([]);

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((lista) => {
        if (!cancelado) setRaices(lista);
      })
      .catch(() => {
        if (!cancelado) setRaices([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    obtenerProducto(slug)
      .then((p) => {
        if (!cancelado) setProducto(p);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el producto.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  useSeo(producto?.nombre ?? null, producto?.descripcion_corta ?? (producto ? `${producto.nombre} con envío a todo el país y precio final con IVA incluido.` : null));

  if (cargando) {
    return (
      <Tienda>
        <div className="container mx-auto grid gap-8 px-4 py-8 lg:grid-cols-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </Tienda>
    );
  }

  if (error) {
    return (
      <Tienda>
        <NoEncontrado titulo="No pudimos cargar el producto" detalle={error} />
      </Tienda>
    );
  }

  if (!producto) {
    return (
      <Tienda>
        <NoEncontrado titulo="No encontramos este producto" />
      </Tienda>
    );
  }

  // La cadena completa (Notebooks › Notebooks gamer) cuando el árbol ya cargó; si no, la categoría del producto.
  const cadena = producto.categoria_id !== null ? rutaDeCategoria(raices, producto.categoria_id) : [];
  const migas: Miga[] = [
    ...(cadena.length > 0
      ? cadena.map((c) => ({ nombre: c.nombre, ruta: `/${c.slug}` }))
      : producto.categoria_nombre && producto.categoria_slug
        ? [{ nombre: producto.categoria_nombre, ruta: `/${producto.categoria_slug}` }]
        : []),
    { nombre: producto.nombre },
  ];

  return (
    <Tienda>
      <div className="container mx-auto space-y-10 px-4 py-8">
        <MigasDePan migas={migas} />

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <Galeria imagenes={imagenesDe(producto)} nombre={producto.nombre} />

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              {producto.oferta && <Badge>Oferta</Badge>}
              {producto.marca && <Badge variant="outline">{producto.marca}</Badge>}
            </div>
            <div className="space-y-1">
              <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px] md:text-[40px] md:leading-[44px] md:tracking-[-1px]">{producto.nombre}</h1>
              {producto.sku && <p className="text-sm text-muted-foreground">Código {producto.sku}</p>}
            </div>
            {producto.descripcion_corta && <p className="text-base leading-6 text-muted-foreground">{producto.descripcion_corta}</p>}

            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <Precio precioFinal={producto.precio_final_ars} precioLista={producto.precio_lista_ars} tamano="ficha" conCuotas />
              <EstadoDeStock producto={producto} />
              <Button size="lg" className="w-full gap-2" disabled={!producto.hay_stock} onClick={() => agregarYAvisar(producto)}>
                <ShoppingCart className="h-5 w-5" aria-hidden />
                Agregar al carrito
              </Button>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>Envío a todo el país, al mismo precio en cualquier provincia.</li>
                <li>Configuración de fábrica: sin ampliaciones de memoria ni de disco.</li>
                <li>Arrepentimiento dentro de los 10 días corridos de recibirlo.</li>
              </ul>
            </div>
          </div>
        </div>

        <FichaTecnica producto={producto} />
      </div>
    </Tienda>
  );
}
