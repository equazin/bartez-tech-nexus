import { Link } from "react-router-dom";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Precio } from "@/components/tienda/Precio";
import { EtiquetasDeProducto, agregarYAvisar } from "@/components/tienda/TarjetaProducto";
import { imagenPrincipal, rutaDelProducto } from "@/lib/tienda/catalogo";
import type { ElegidoDeLaSemana as Elegido } from "@/lib/tienda/portada";

/** Un producto con sus datos clave, el precio y por qué lo elegimos: el "te decimos cuál comprar" de la marca. */
export function ElegidoDeLaSemana({ elegido }: { elegido: Elegido }) {
  const { producto, datos, razones } = elegido;
  const imagen = imagenPrincipal(producto);
  const ruta = rutaDelProducto(producto);

  return (
    <section className="container mx-auto px-4 py-10 lg:py-14" aria-labelledby="elegido-titulo">
      <div className="grid gap-8 rounded-2xl border border-border bg-card p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-8 lg:gap-12">
        <Link to={ruta} className="relative block overflow-hidden rounded-xl bg-placa-foto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foco-placa))]">
          <div className="aspect-square p-6">
            {imagen ? (
              <img src={imagen} alt={producto.nombre} loading="lazy" className="h-full w-full object-contain mix-blend-multiply" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-texto-placa">Sin foto</div>
            )}
          </div>
          <EtiquetasDeProducto producto={producto} className="absolute left-3 top-3" />
        </Link>

        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <p id="elegido-titulo" className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">
              Elegido de la semana
            </p>
            {producto.marca && <p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">{producto.marca}</p>}
            <h2 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">
              <Link to={ruta} className="hover:underline">
                {producto.nombre}
              </Link>
            </h2>
          </div>

          {datos.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Datos clave">
              {datos.map((dato) => (
                <li key={dato} className="inline-flex h-9 items-center rounded-chip bg-secondary px-3 text-sm font-medium">
                  {dato}
                </li>
              ))}
            </ul>
          )}

          <Precio precioFinal={producto.precio_final_ars} precioLista={producto.precio_lista_ars} conCuotas />

          <div className="space-y-2">
            <h3 className="font-bold">Por qué lo elegimos</h3>
            <ul className="space-y-2">
              {razones.map((razon) => (
                <li key={razon} className="flex gap-2 text-sm leading-5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{razon}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={ruta}>Ver el producto</Link>
            </Button>
            <Button size="lg" variant="outline" disabled={!producto.hay_stock} onClick={() => agregarYAvisar(producto)} className="gap-2">
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {producto.hay_stock ? "Agregar al carrito" : "Sin stock"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
