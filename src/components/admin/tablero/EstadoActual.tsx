import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tab } from "@/components/admin/layout/adminNavConfig";
import type { ResumenDelTablero } from "@/lib/api/tablero";
import { contar, diaYHora, entero, pesos } from "@/lib/panel/formatos";
import type { GrupoDePedidos, PedidosEnCurso as EnCurso } from "@/lib/panel/ventas";
import { Tarjeta } from "./piezas";

/** Los pedidos abiertos, por estado. Cada fila lleva a la pantalla donde se resuelve. */
export function PedidosEnCurso({
  enCurso,
  venceHoras,
  onIr,
  className,
}: {
  enCurso: EnCurso;
  venceHoras: number | null;
  onIr: (tab: Tab) => void;
  className?: string;
}) {
  const filas: Array<{ clave: string; etiqueta: string; grupo: GrupoDePedidos; destino: Tab; conMonto?: boolean }> = [
    { clave: "transferencia", etiqueta: "Esperando una transferencia", grupo: enCurso.esperandoTransferencia, destino: "pagos", conMonto: true },
    { clave: "mercadopago", etiqueta: "Esperando el pago en Mercado Pago", grupo: enCurso.esperandoMercadoPago, destino: "pagos", conMonto: true },
    { clave: "pagados", etiqueta: "Pagados, sin preparar", grupo: enCurso.pagados, destino: "orders" },
    { clave: "preparacion", etiqueta: "En preparación", grupo: enCurso.enPreparacion, destino: "orders" },
    { clave: "camino", etiqueta: "En camino", grupo: enCurso.enCamino, destino: "orders" },
  ];
  return (
    <Tarjeta titulo="Pedidos en curso" className={className}>
      <ul className="-mx-2 flex-1">
        {filas.map(({ clave, etiqueta, grupo, destino, conMonto }) => (
          <li key={clave}>
            <button
              type="button"
              onClick={() => onIr(destino)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={cn("min-w-0 text-sm", grupo.cantidad > 0 ? "text-foreground" : "text-muted-foreground")}>{etiqueta}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                {conMonto && grupo.cantidad > 0 && <span className="text-xs tabular-nums text-muted-foreground">{pesos(grupo.total)}</span>}
                <span className={cn("min-w-[1.5rem] text-right text-sm font-bold tabular-nums", grupo.cantidad > 0 ? "text-foreground" : "text-muted-foreground")}>{entero(grupo.cantidad)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {venceHoras !== null && venceHoras > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">Un pedido sin pagar vence a las {entero(venceHoras)} horas y libera el stock.</p>
      )}
    </Tarjeta>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xl font-bold leading-tight text-foreground">{valor}</p>
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
    </div>
  );
}

/** El catálogo publicado, el dólar con el que se calculan los precios y la última sincronización con los mayoristas. */
export function CatalogoYPrecios({
  resumen,
  ahora,
  onIr,
  className,
}: {
  resumen: ResumenDelTablero | null;
  ahora: Date;
  onIr: (tab: Tab) => void;
  className?: string;
}) {
  if (!resumen) {
    return (
      <Tarjeta titulo="Catálogo y precios" className={className}>
        <p className="text-sm text-muted-foreground">Leyendo el catálogo</p>
      </Tarjeta>
    );
  }
  const { catalogo, dolar, sincronizacion } = resumen;
  const avisos = [
    catalogo.sinFoto > 0 ? contar(catalogo.sinFoto, "publicado sin foto", "publicados sin foto") : null,
    catalogo.sinDescripcion > 0 ? contar(catalogo.sinDescripcion, "publicado sin descripción", "publicados sin descripción") : null,
    catalogo.sinPublicar > 0 ? contar(catalogo.sinPublicar, "sin publicar", "sin publicar") : null,
    catalogo.precioManual > 0 ? contar(catalogo.precioManual, "con precio fijo en pesos", "con precio fijo en pesos") : null,
  ].filter((a): a is string => a !== null);
  const conFalla = sincronizacion?.mayoristas.filter((m) => m.estado !== "ok").map((m) => m.nombre) ?? [];
  const alDia = sincronizacion?.mayoristas.filter((m) => m.estado === "ok").map((m) => m.nombre) ?? [];

  return (
    <Tarjeta titulo="Catálogo y precios" className={className}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Dato etiqueta="Productos publicados" valor={entero(catalogo.publicados)} />
        <Dato etiqueta="Sin stock" valor={entero(catalogo.sinStock)} />
        <Dato etiqueta="Con 1 a 3 unidades" valor={entero(catalogo.pocasUnidades)} />
        <Dato etiqueta="En oferta" valor={entero(catalogo.enOferta)} />
      </div>
      {avisos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {avisos.map((aviso) => (
            <li key={aviso} className="rounded-chip bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {aviso}
            </li>
          ))}
        </ul>
      )}
      <dl className="mt-4 space-y-2 border-t border-border/70 pt-3 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Dólar de los precios</dt>
          <dd className="text-right font-bold tabular-nums text-foreground">
            {dolar ? pesos(dolar.valor) : "Sin dato"}
            {dolar?.desde && <span className="ml-1.5 font-normal text-muted-foreground">desde {diaYHora(dolar.desde, ahora)}</span>}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Costos y stock de los mayoristas</dt>
          <dd className={cn("text-right", conFalla.length > 0 ? "font-bold text-danger" : "text-foreground")}>
            {!sincronizacion
              ? "Sin dato"
              : conFalla.length > 0
                ? `${conFalla.join(" y ")}: con error`
                : `${alDia.length > 0 ? `${alDia.join(" y ")}, ` : ""}${diaYHora(sincronizacion.termino, ahora) || "sin fecha"}`}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onIr("products")}>
          Productos
        </Button>
        <Button size="sm" variant="outline" onClick={() => onIr("dolar")}>
          Dólar y margen
        </Button>
      </div>
    </Tarjeta>
  );
}
