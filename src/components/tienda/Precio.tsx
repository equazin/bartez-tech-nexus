import type { ProductoPublico } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { CUOTAS_SIN_INTERES, MEDIO_CON_CUOTAS, nombreCortoDeMedio, preciosDe, valorDeLaCuota } from "@/lib/tienda/precios";
import { cn } from "@/lib/utils";

/**
 * Las cuotas sin interés del medio en cuotas: "3 cuotas sin interés de $ X" sobre su propio precio, con el total y el
 * costo financiero (0 %). Mercado Pago cobra esas cuotas sin interés: la preferencia deja hasta 3 y solo con crédito.
 */
export function Cuotas({ monto, conDetalle = true }: { monto: number; conDetalle?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-sm">
        <span className="font-bold tabular-nums">{CUOTAS_SIN_INTERES} cuotas sin interés</span> de{" "}
        <span className="font-bold tabular-nums">{formatearPesos(valorDeLaCuota(monto))}</span>
      </p>
      {conDetalle && (
        <p className="text-xs text-muted-foreground">Total {formatearPesos(monto)} · CFTEA 0 % · TEA 0 % · con tarjeta de crédito por Mercado Pago</p>
      )}
    </div>
  );
}

/** "3 cuotas sin interés de $ 55.390", en una línea, para las tarjetas de producto. */
export function CuotasBreves({ monto }: { monto: number }) {
  return (
    <span className="text-xs text-muted-foreground">
      <span className="font-bold text-foreground tabular-nums">{CUOTAS_SIN_INTERES} cuotas sin interés</span> de{" "}
      <span className="tabular-nums">{formatearPesos(valorDeLaCuota(monto))}</span>
    </span>
  );
}

interface Props {
  precioFinal: number | null;
  precioLista?: number | null;
  tamano?: "tarjeta" | "ficha";
  /** El monto es el del medio en cuotas: muestra las cuotas sin interés. */
  conCuotas?: boolean;
  className?: string;
}

/** Un monto final en pesos, con IVA incluido, y las cuotas sin interés si es el precio del medio en cuotas. */
export function Precio({ precioFinal, precioLista, tamano = "tarjeta", conCuotas = false, className }: Props) {
  if (precioFinal === null || precioFinal === undefined) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const hayOferta = typeof precioLista === "number" && precioLista > precioFinal;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">{formatearPesos(precioLista)}</span>}
      <span className={cn("font-bold leading-none tabular-nums", tamano === "ficha" ? "text-[28px]" : "text-xl")}>{formatearPesos(precioFinal)}</span>
      <span className="text-xs text-muted-foreground">Precio final con IVA incluido</span>
      {conCuotas && <Cuotas monto={precioFinal} />}
    </div>
  );
}

type ProductoConPrecios = Pick<ProductoPublico, "precio_final_ars" | "precio_lista_ars" | "precios_por_medio">;

const etiquetaDelMedio = (m: { id: string; nombre: string }, varios: boolean): string => {
  if (!varios) return "Precio final";
  if (m.id === "transferencia") return "Con transferencia";
  if (m.id === "mercadopago") return "Con Mercado Pago, en 1 pago";
  return `Con ${nombreCortoDeMedio(m)}`;
};

/**
 * Los precios del producto por medio de pago: el más barato (transferencia) grande, Mercado Pago en 1 pago debajo y
 * las 3 cuotas sin interés sobre el precio del medio en cuotas.
 */
export function PreciosDelProducto({ producto, tamano = "tarjeta", className }: { producto: ProductoConPrecios; tamano?: "tarjeta" | "ficha" | "destacado"; className?: string }) {
  const precios = preciosDe(producto);
  const principal = precios[0];
  if (!principal || principal.precio === null) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const enCuotas = precios.find((m) => m.id === MEDIO_CON_CUOTAS && m.precio !== null);
  const deContado = precios.filter((m) => m.id !== MEDIO_CON_CUOTAS);
  const hayOferta = typeof producto.precio_lista_ars === "number" && producto.precio_lista_ars > principal.precio;

  if (tamano === "tarjeta") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {hayOferta && <span className="text-[13px] tabular-nums text-muted-foreground line-through">{formatearPesos(producto.precio_lista_ars as number)}</span>}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[22px] font-bold leading-tight tracking-[-0.01em] tabular-nums">{formatearPesos(principal.precio)}</span>
          {precios.length > 1 && <span className="text-xs text-muted-foreground">{nombreCortoDeMedio(principal)}</span>}
        </div>
        {deContado.slice(1).map((m) =>
          m.precio === null ? null : (
            <span key={m.id} className="text-[13px] leading-snug">
              <span className="font-bold tabular-nums">{formatearPesos(m.precio)}</span> <span className="text-muted-foreground">con {nombreCortoDeMedio(m)}</span>
            </span>
          ),
        )}
        {enCuotas?.precio ? <CuotasBreves monto={enCuotas.precio} /> : <span className="text-xs text-muted-foreground">Precio final con IVA</span>}
      </div>
    );
  }

  const varios = precios.length > 1;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">Antes {formatearPesos(producto.precio_lista_ars as number)}</span>}
      <div className={cn("grid gap-2", varios && tamano === "ficha" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        {deContado.map((m, i) =>
          m.precio === null ? null : (
            <div key={m.id} className={cn("flex flex-col gap-1 rounded-xl border bg-background px-3.5 py-3", i === 0 ? "border-foreground" : "border-border")}>
              <span className="text-xs text-muted-foreground">{etiquetaDelMedio(m, varios)}</span>
              <span className={cn("font-bold leading-none tracking-[-0.02em] tabular-nums", i === 0 ? "text-[30px] md:text-[34px]" : "text-[22px] md:text-[26px]")}>
                {formatearPesos(m.precio)}
              </span>
            </div>
          ),
        )}
        {enCuotas?.precio ? (
          <div className={cn("flex flex-col gap-1 rounded-xl border border-border bg-background px-3.5 py-3", tamano === "ficha" && "sm:col-span-2")}>
            <span className="text-xs text-muted-foreground">En {CUOTAS_SIN_INTERES} cuotas sin interés</span>
            <span className="text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums md:text-[26px]">
              {CUOTAS_SIN_INTERES} × {formatearPesos(valorDeLaCuota(enCuotas.precio))}
            </span>
            <span className="text-xs text-muted-foreground">
              Total {formatearPesos(enCuotas.precio)} · CFTEA 0 % · TEA 0 % · con tarjeta de crédito por Mercado Pago
            </span>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Precios finales con IVA incluido. El medio lo elegís al pagar.</p>
    </div>
  );
}
