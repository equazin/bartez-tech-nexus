import { medirAgregadoAlCarrito } from "@/lib/tienda/medicion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { agregarAlCarrito } from "@/lib/tienda/carrito";
import { imagenPrincipal, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { alternarComparacion, useComparador } from "@/lib/tienda/comparador";
import { datosClave } from "@/lib/tienda/ficha";
import { cn } from "@/lib/utils";
import { PreciosDelProducto } from "./Precio";

export function EstadoDeStock({ producto, className }: { producto: Pick<ProductoPublico, "hay_stock" | "pocas_unidades">; className?: string }) {
  if (!producto.hay_stock) return <span className={cn("text-[13px] text-muted-foreground", className)}>Sin stock</span>;
  if (producto.pocas_unidades)
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", className)}>
        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
        Últimas unidades
      </span>
    );
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-success", className)}>
      <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
      En stock
    </span>
  );
}

export function agregarYAvisar(
  producto: Pick<ProductoPublico, "id" | "slug" | "nombre"> & Partial<Pick<ProductoPublico, "sku" | "marca" | "categoria_nombre" | "precio_final_ars">>,
  cantidad = 1,
) {
  agregarAlCarrito(producto.id, producto.slug, cantidad);
  medirAgregadoAlCarrito(producto, cantidad);
  toast.success("Agregado al carrito", { description: producto.nombre });
}

export function compararYAvisar(producto: ProductoPublico) {
  const resultado = alternarComparacion({
    id: producto.id,
    slug: producto.slug,
    nombre: producto.nombre,
    marca: producto.marca,
    imagen: imagenPrincipal(producto),
    categoria_slug: producto.categoria_slug,
  });
  if (resultado === "lleno") toast("Podés comparar hasta tres productos", { description: "Quitá uno de la bandeja de abajo para sumar este." });
}

export function ChipsDeDatos({ datos, className }: { datos: string[]; className?: string }) {
  if (datos.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Datos clave">
      {datos.map((dato) => (
        <li key={dato} className="rounded-chip bg-secondary px-2 py-1 text-xs leading-none">
          {dato}
        </li>
      ))}
    </ul>
  );
}

interface PropsDeTarjeta {
  producto: ProductoPublico;
  /** Muestra el botón para sumarlo al comparador (listados de categoría y búsqueda). */
  conComparar?: boolean;
}

export function TarjetaProducto({ producto, conComparar = false }: PropsDeTarjeta) {
  const imagen = imagenPrincipal(producto);
  const ruta = rutaDelProducto(producto);
  const comparando = useComparador().some((p) => p.id === producto.id);
  const datos = datosClave(producto, 4);
  const hayOferta = typeof producto.precio_lista_ars === "number" && producto.precio_final_ars !== null && producto.precio_lista_ars > producto.precio_final_ars;

  return (
    <article className={cn("flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-card p-3 transition-colors hover:border-input", comparando ? "border-foreground" : "border-border")}>
      <div className="relative">
        <Link
          to={ruta}
          className="flex h-[170px] items-center justify-center rounded-xl bg-placa-foto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--foco-placa))]"
        >
          {imagen ? (
            <img src={imagen} alt={producto.nombre} loading="lazy" className="max-h-[146px] max-w-[86%] object-contain mix-blend-multiply" />
          ) : (
            <span className="text-sm text-texto-placa">Sin foto</span>
          )}
        </Link>
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
          {hayOferta && <span className="rounded-chip bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground">Oferta</span>}
          {producto.pocas_unidades && producto.hay_stock && <span className="rounded-chip bg-background px-2 py-1 text-[11px] font-bold">Últimas unidades</span>}
        </div>
      </div>

      {producto.marca && <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{producto.marca}</p>}
      <h3 className="min-h-[38px] text-sm font-medium leading-[1.35]">
        <Link to={ruta} className="line-clamp-2 hover:underline">
          {producto.nombre}
        </Link>
      </h3>
      <ChipsDeDatos datos={datos} />

      <PreciosDelProducto producto={producto} className="mt-auto pt-1" />

      {conComparar ? (
        <div className="flex flex-col gap-2">
          <EstadoDeStock producto={producto} />
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={comparando}
              onClick={() => compararYAvisar(producto)}
              className={cn(
                "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-input text-[13px] font-bold transition-colors",
                comparando ? "bg-accent" : "hover:bg-secondary",
              )}
            >
              <span className={cn("h-3.5 w-3.5 rounded-[4px] border-[1.5px] border-foreground", comparando && "border-primary bg-primary")} aria-hidden />
              Comparar
            </button>
            <button
              type="button"
              disabled={!producto.hay_stock || producto.precio_final_ars === null}
              onClick={() => agregarYAvisar(producto)}
              className="h-10 flex-1 rounded-xl bg-primary text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
            >
              Agregar
            </button>
          </div>
        </div>
      ) : (
        // El stock arriba y el botón a todo el ancho: en tarjetas angostas no se aprietan uno contra el otro.
        <div className="flex flex-col gap-2">
          <EstadoDeStock producto={producto} className="whitespace-nowrap" />
          <button
            type="button"
            disabled={!producto.hay_stock || producto.precio_final_ars === null}
            onClick={() => agregarYAvisar(producto)}
            className="h-10 w-full rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
          >
            Agregar
          </button>
        </div>
      )}
    </article>
  );
}

export function TarjetaEsqueleto() {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3">
      <Skeleton className="h-[170px] rounded-xl" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}

const COLUMNAS = {
  seis: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  cinco: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  cuatro: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  "con-filtros": "grid-cols-2 md:grid-cols-3 2xl:grid-cols-4",
} as const;

interface PropsDeGrilla {
  productos: ProductoPublico[];
  cargando?: boolean;
  cantidadEsqueletos?: number;
  columnas?: keyof typeof COLUMNAS;
  conComparar?: boolean;
}

export function GrillaProductos({ productos, cargando, cantidadEsqueletos = 8, columnas = "cuatro", conComparar = false }: PropsDeGrilla) {
  return (
    <div className={cn("grid gap-3", COLUMNAS[columnas])}>
      {cargando && productos.length === 0
        ? Array.from({ length: cantidadEsqueletos }).map((_, i) => <TarjetaEsqueleto key={i} />)
        : productos.map((producto) => <TarjetaProducto key={producto.id} producto={producto} conComparar={conComparar} />)}
    </div>
  );
}
