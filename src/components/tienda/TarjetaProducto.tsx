import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agregarAlCarrito } from "@/lib/tienda/carrito";
import { imagenPrincipal, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { cn } from "@/lib/utils";
import { Precio } from "./Precio";

export function EstadoDeStock({ producto }: { producto: Pick<ProductoPublico, "hay_stock"> }) {
  if (!producto.hay_stock) return <span className="text-sm text-muted-foreground">Sin stock</span>;
  // Las pocas unidades las marca la etiqueta "Últimas unidades" arriba de la foto.
  return <span className="text-sm text-success">En stock</span>;
}

/** Oferta (con el ahorro), Nuevo y Últimas unidades: lo que la tarjeta y la ficha marcan arriba de la foto. */
export function EtiquetasDeProducto({
  producto,
  className,
}: {
  producto: Pick<ProductoPublico, "oferta" | "ahorro_pct" | "nuevo" | "pocas_unidades" | "hay_stock">;
  className?: string;
}) {
  const etiquetas: Array<{ texto: string; variante: "default" | "secondary" | "warning" }> = [];
  if (producto.oferta) etiquetas.push({ texto: producto.ahorro_pct && producto.ahorro_pct > 0 ? `Oferta -${producto.ahorro_pct}%` : "Oferta", variante: "default" });
  if (producto.nuevo) etiquetas.push({ texto: "Nuevo", variante: "secondary" });
  if (producto.hay_stock && producto.pocas_unidades) etiquetas.push({ texto: "Últimas unidades", variante: "warning" });
  if (etiquetas.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {etiquetas.map((e) => (
        <Badge key={e.texto} variant={e.variante}>
          {e.texto}
        </Badge>
      ))}
    </div>
  );
}

export function agregarYAvisar(producto: Pick<ProductoPublico, "id" | "slug" | "nombre">, cantidad = 1) {
  agregarAlCarrito(producto.id, producto.slug, cantidad);
  toast.success("Agregado al carrito", { description: producto.nombre });
}

export function TarjetaProducto({ producto }: { producto: ProductoPublico }) {
  const imagen = imagenPrincipal(producto);
  const ruta = rutaDelProducto(producto);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <Link to={ruta} className="relative block overflow-hidden rounded-xl bg-placa-foto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foco-placa))]">
        <div className="aspect-square p-4">
          {imagen ? (
            <img src={imagen} alt={producto.nombre} loading="lazy" className="h-full w-full object-contain mix-blend-multiply" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-texto-placa">Sin foto</div>
          )}
        </div>
        <EtiquetasDeProducto producto={producto} className="absolute left-3 top-3" />
      </Link>

      <div className="flex flex-1 flex-col gap-2">
        {producto.marca && <p className="text-xs font-bold uppercase tracking-[1px] text-muted-foreground">{producto.marca}</p>}
        <h3 className="text-base font-medium leading-snug">
          <Link to={ruta} className="hover:underline">
            {producto.nombre}
          </Link>
        </h3>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Precio precioFinal={producto.precio_final_ars} precioLista={producto.precio_lista_ars} conCuotas />
          <EstadoDeStock producto={producto} />
        </div>
      </div>

      <Button variant="outline" disabled={!producto.hay_stock} onClick={() => agregarYAvisar(producto)} className="gap-2">
        <ShoppingCart className="h-4 w-4" aria-hidden />
        Agregar al carrito
      </Button>
    </article>
  );
}

export function TarjetaEsqueleto() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function GrillaProductos({ productos, cargando, cantidadEsqueletos = 8 }: { productos: ProductoPublico[]; cargando?: boolean; cantidadEsqueletos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {cargando && productos.length === 0
        ? Array.from({ length: cantidadEsqueletos }).map((_, i) => <TarjetaEsqueleto key={i} />)
        : productos.map((producto) => <TarjetaProducto key={producto.id} producto={producto} />)}
    </div>
  );
}
