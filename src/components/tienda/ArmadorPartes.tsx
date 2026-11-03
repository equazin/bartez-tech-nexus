import { Link } from "react-router-dom";
import { AlertTriangle, Check, X } from "lucide-react";
import { ChipsDeDatos } from "@/components/tienda/TarjetaProducto";
import type { Armado, Evaluacion, Seleccion } from "@/lib/tienda/armador";
import { imagenPrincipal, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { datosClave } from "@/lib/tienda/ficha";
import { precioConMedio, preciosDe } from "@/lib/tienda/precios";
import type { ServicioPublico } from "@/lib/tienda/servicios";
import { cn } from "@/lib/utils";

/** Piezas de la página Armá tu PC: opciones de un paso, tarjetas de PC armadas y servicios. */

/** "Procesador AMD Ryzen 5 7600, 6 núcleos, AM5" → "AMD Ryzen 5 7600". */
export function nombreCorto(producto: Pick<ProductoPublico, "nombre">): string {
  return producto.nombre
    .split(",")[0]
    .replace(/^(procesador|motherboard|memoria ram|disco ssd|disco rígido|disco|placa de video|fuente|gabinete|cooler)\s+/i, "")
    .trim();
}

/** Los datos que distinguen a una PC armada, cortos: "Ryzen 5 7600", "RTX 5060 Ti 8 GB", "16 GB DDR5", "SSD 500 GB". */
export function chipsDeArmada(seleccion: Seleccion, piezas: Armado["piezas"]): string[] {
  const chips: string[] = [];
  const { procesador, video, memoria, almacenamiento } = seleccion;
  if (procesador) chips.push(nombreCorto(procesador).replace(/^(amd|intel)\s+/i, ""));
  if (video) {
    const modelo = video.nombre.match(/\b(RTX|GTX|RX|Arc)\s*[A-Z]?\d{3,4}\s*(Ti|XTX|XT|GRE|SUPER)?/i)?.[0];
    const gb = video.nombre.match(/(\d+)\s*GB/i)?.[1];
    chips.push(modelo ? `${modelo.replace(/\s+/g, " ").trim()}${gb ? ` ${gb} GB` : ""}` : nombreCorto(video));
  } else if (procesador) {
    chips.push("Gráficos integrados");
  }
  if (memoria) {
    const gb = memoria.nombre.match(/(\d+)\s*GB/i)?.[1];
    const tipo = memoria.nombre.match(/DDR\d/i)?.[0]?.toUpperCase();
    const total = gb ? Number(gb) * (piezas.memoria?.cantidad ?? 1) : null;
    chips.push([total ? `${total} GB` : "", tipo ?? ""].filter(Boolean).join(" ") || nombreCorto(memoria));
  }
  if (almacenamiento) {
    const capacidad = almacenamiento.nombre.match(/(\d+)\s*(GB|TB)/i);
    const tipo = /ssd|nvme/i.test(almacenamiento.nombre) ? "SSD" : "Disco";
    chips.push(capacidad ? `${tipo} ${capacidad[1]} ${capacidad[2].toUpperCase()}` : nombreCorto(almacenamiento));
  }
  return chips;
}

export function Insignia({ evaluacion }: { evaluacion: Evaluacion }) {
  if (evaluacion.estado === "compatible")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Compatible
      </span>
    );
  if (evaluacion.estado === "revisar")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-primary" aria-hidden />
        {evaluacion.motivo}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
      <X className="h-3.5 w-3.5" aria-hidden />
      {evaluacion.motivo}
    </span>
  );
}

export function FilaDeOpcion({
  producto,
  evaluacion,
  elegido,
  onElegir,
}: {
  producto: ProductoPublico;
  evaluacion: Evaluacion;
  elegido: boolean;
  onElegir: () => void;
}) {
  const foto = imagenPrincipal(producto);
  const precioMp = precioConMedio(producto, "mercadopago");
  const noVa = evaluacion.estado === "incompatible";
  return (
    <li className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-background p-2.5", elegido ? "border-foreground" : "border-border", noVa && "opacity-60")}>
      <Link to={rutaDelProducto(producto)} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-placa-foto" aria-label={`Ver la ficha de ${producto.nombre}`}>
        {foto && <img src={foto} alt="" loading="lazy" className="max-h-14 max-w-14 object-contain mix-blend-multiply" />}
      </Link>
      <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1">
        <Link to={rutaDelProducto(producto)} className="line-clamp-2 text-[13px] font-medium leading-snug hover:underline">
          {producto.nombre}
        </Link>
        <ChipsDeDatos datos={datosClave(producto, 3)} />
        <Insignia evaluacion={evaluacion} />
        <span className="text-[15px] font-bold tabular-nums">
          {producto.precio_final_ars !== null ? formatearPesos(producto.precio_final_ars) : "A confirmar"}
          {precioMp !== null && precioMp !== producto.precio_final_ars && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">· {formatearPesos(precioMp)} con Mercado Pago</span>
          )}
        </span>
        {!producto.hay_stock && <span className="text-xs text-muted-foreground">Sin stock</span>}
      </div>
      <button
        type="button"
        onClick={onElegir}
        disabled={noVa || !producto.hay_stock || producto.precio_final_ars === null}
        aria-pressed={elegido}
        className={cn(
          "h-10 min-w-[84px] rounded-xl px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
          elegido ? "bg-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {noVa ? "No va" : elegido ? "Elegida" : "Elegir"}
      </button>
    </li>
  );
}

export type EstadoDeArmada = "libre" | "cargada" | "modificada";

export function TarjetaDeArmada({
  nombre,
  texto,
  chips,
  foto,
  totales,
  estado,
  onCargar,
}: {
  nombre: string;
  texto: string;
  chips: string[];
  foto: string | null;
  totales: Array<{ id: string; nombre: string; total: number }>;
  estado: EstadoDeArmada;
  onCargar: () => void;
}) {
  const [principal, segundo] = totales;
  return (
    <article className={cn("flex min-w-0 flex-col rounded-2xl bg-card p-3", estado === "libre" ? "border border-border" : "border-2 border-foreground")}>
      <span className="flex h-[150px] items-center justify-center rounded-xl bg-placa-foto">
        {foto && <img src={foto} alt="" loading="lazy" className="max-h-[130px] max-w-[70%] object-contain mix-blend-multiply" />}
      </span>
      <span className="mt-3 flex min-w-0 flex-1 flex-col gap-2 px-1">
        <span className="font-display text-lg font-bold uppercase leading-tight">{nombre}</span>
        {texto && <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{texto}</span>}
        <ChipsDeDatos datos={chips} />
        <span className="mt-auto flex flex-col pt-1">
          {principal && <span className="text-[22px] font-bold tabular-nums">{formatearPesos(principal.total)}</span>}
          {segundo && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatearPesos(segundo.total)} con {segundo.nombre}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onCargar}
          className={cn(
            "mt-1 h-10 w-full rounded-xl border px-3.5 text-[13px] font-bold transition-colors",
            estado === "cargada" && "border-foreground bg-foreground text-background",
            estado === "modificada" && "border-input hover:bg-secondary",
            estado === "libre" && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {estado === "cargada" ? "Cargada en la lista" : estado === "modificada" ? "Volver a cargarla" : "Cargar esta"}
        </button>
      </span>
    </article>
  );
}

export function FilaDeServicio({ servicio, elegido, onAlternar }: { servicio: ServicioPublico; elegido: boolean; onAlternar: () => void }) {
  const [principal, segundo] = preciosDe(servicio);
  return (
    <li>
      <label className={cn("flex cursor-pointer items-center gap-3.5 rounded-2xl border bg-card px-4 py-3.5", elegido ? "border-foreground" : "border-border")}>
        <input type="checkbox" checked={elegido} onChange={onAlternar} className="h-5 w-5 shrink-0 accent-primary" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-bold">{servicio.nombre}</span>
          {servicio.texto && <span className="text-[13px] leading-snug text-muted-foreground">{servicio.texto}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end">
          {principal?.precio != null && <span className="font-bold tabular-nums">{formatearPesos(principal.precio)}</span>}
          {segundo?.precio != null && segundo.precio !== principal?.precio && (
            <span className="text-xs tabular-nums text-muted-foreground">{formatearPesos(segundo.precio)} con Mercado Pago</span>
          )}
        </span>
      </label>
    </li>
  );
}
