import type { PrecioPorMedio, ProductoPublico } from "@/lib/tienda/catalogo";
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

/** "3 cuotas sin interés de $ 55.390", en una línea y en verde, para las tarjetas de producto. */
export function CuotasBreves({ monto }: { monto: number }) {
  return (
    <span className="text-[13px] font-semibold leading-snug text-success">
      {CUOTAS_SIN_INTERES} cuotas sin interés de <span className="tabular-nums">{formatearPesos(valorDeLaCuota(monto))}</span>
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

/** Lo que se ahorra con el medio más barato frente al siguiente (transferencia frente a Mercado Pago en 1 pago). */
const ahorroFrente = (principal: PrecioPorMedio, otro: PrecioPorMedio | undefined): number =>
  otro && otro.precio !== null && principal.precio !== null && otro.precio > principal.precio ? otro.precio - principal.precio : 0;

/**
 * Los precios del producto por medio de pago. Se destacan dos: transferencia (el más barato, en grafito, con lo que se
 * ahorra) y las 3 cuotas sin interés (en verde). Mercado Pago en 1 pago queda en una línea simple debajo.
 */
export function PreciosDelProducto({ producto, tamano = "tarjeta", className }: { producto: ProductoConPrecios; tamano?: "tarjeta" | "ficha" | "destacado"; className?: string }) {
  const precios = preciosDe(producto);
  const principal = precios[0];
  if (!principal || principal.precio === null) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Precio a confirmar</p>;
  }
  const enCuotas = precios.find((m) => m.id === MEDIO_CON_CUOTAS && m.precio !== null);
  const otrosDeContado = precios.filter((m) => m.id !== MEDIO_CON_CUOTAS && m.id !== principal.id && m.precio !== null);
  const hayOferta = typeof producto.precio_lista_ars === "number" && producto.precio_lista_ars > principal.precio;

  if (tamano === "tarjeta") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {hayOferta && <span className="text-[13px] tabular-nums text-muted-foreground line-through">{formatearPesos(producto.precio_lista_ars as number)}</span>}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[22px] font-bold leading-tight tracking-[-0.01em] tabular-nums">{formatearPesos(principal.precio)}</span>
          {precios.length > 1 && <span className="text-xs font-semibold">con {nombreCortoDeMedio(principal).toLowerCase()}</span>}
        </div>
        {enCuotas?.precio ? <CuotasBreves monto={enCuotas.precio} /> : <span className="text-xs text-muted-foreground">Precio final con IVA</span>}
        {otrosDeContado.map((m) => (
          <span key={m.id} className="text-xs leading-snug text-muted-foreground">
            <span className="tabular-nums">{formatearPesos(m.precio as number)}</span> con {nombreCortoDeMedio(m)}
          </span>
        ))}
      </div>
    );
  }

  const varios = precios.length > 1;
  const ahorro = ahorroFrente(principal, otrosDeContado[0]);
  const enDosColumnas = tamano === "ficha" && Boolean(enCuotas?.precio);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hayOferta && <span className="text-sm tabular-nums text-muted-foreground line-through">Antes {formatearPesos(producto.precio_lista_ars as number)}</span>}
      <div className={cn("grid gap-2", enDosColumnas ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
        <div className="flex flex-col gap-1.5 rounded-xl bg-foreground px-4 py-3.5 text-background">
          <span className="text-xs font-semibold text-background/75">{etiquetaDelMedio(principal, varios)}</span>
          <span className="text-[32px] font-bold leading-none tracking-[-0.02em] tabular-nums md:text-[36px]">{formatearPesos(principal.precio)}</span>
          {ahorro > 0 && otrosDeContado[0] && (
            <span className="text-[13px] font-semibold leading-snug">
              Ahorrás {formatearPesos(ahorro)} frente a {nombreCortoDeMedio(otrosDeContado[0])}
            </span>
          )}
        </div>
        {enCuotas?.precio ? (
          <div className="flex flex-col gap-1.5 rounded-xl border border-success/40 bg-exito-fondo px-4 py-3.5">
            <span className="text-xs font-bold text-success">{CUOTAS_SIN_INTERES} cuotas sin interés</span>
            <span className="text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums md:text-[30px]">
              {CUOTAS_SIN_INTERES} × {formatearPesos(valorDeLaCuota(enCuotas.precio))}
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              Total {formatearPesos(enCuotas.precio)} · CFTEA 0 % · TEA 0 % · con tarjeta de crédito por Mercado Pago
            </span>
          </div>
        ) : null}
      </div>
      {otrosDeContado.map((m) => (
        <div key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-2.5 text-sm">
          <span className="text-muted-foreground">{etiquetaDelMedio(m, varios)}</span>
          <span className="font-semibold tabular-nums">{formatearPesos(m.precio as number)}</span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Precios finales con IVA incluido. El medio lo elegís al pagar.</p>
    </div>
  );
}
