import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { Tab } from "@/components/admin/layout/adminNavConfig";
import { leerTablero, type ResumenDelTablero } from "@/lib/api/tablero";
import { compacto, contar, entero, pesos, pesosCompactos, porcentaje, variacion } from "@/lib/panel/formatos";
import { estaPagado } from "@/lib/panel/pedidosDeLaTienda";
import { PERIODOS, armarPeriodo, diaDeArgentina, etiquetaLargaDelDia, etiquetaNumericaDelDia, type ClaveDePeriodo } from "@/lib/panel/periodos";
import { comprasDelRango, esDePrueba, pagosPorPedido, pedidosEnCurso, resumirVentas, soloDeLaTienda, type PedidoDelTablero } from "@/lib/panel/ventas";
import { BarrasPorDia } from "./BarrasPorDia";
import { ComprasDelPeriodo } from "./ComprasDelPeriodo";
import { CatalogoYPrecios, PedidosEnCurso } from "./EstadoActual";
import { ParaHacer } from "./ParaHacer";
import { Indicador, ListaConBarras, Tarjeta, type FilaConBarra } from "./piezas";

const CLAVE_DEL_PERIODO = "teqo:tablero:periodo";
/** Al volver al tablero después de este tiempo, se vuelve a leer. */
const VOLVER_A_LEER_MS = 2 * 60 * 1000;

function periodoGuardado(): ClaveDePeriodo {
  try {
    const guardado = window.localStorage.getItem(CLAVE_DEL_PERIODO);
    const encontrado = PERIODOS.find((p) => p.clave === guardado);
    if (encontrado) return encontrado.clave;
  } catch {
    // Sin almacenamiento vale el período por defecto.
  }
  return "7d";
}

/**
 * El tablero de la tienda. Arriba, lo que pasa ahora: lo que espera una acción, los pedidos abiertos y el catálogo.
 * Abajo, las ventas y las visitas del período elegido, comparadas con el período anterior. Las compras llegan del
 * panel (ya las tiene cargadas); las visitas, el catálogo y las comisiones, de la función panel_tablero.
 */
export function TableroDeLaTienda({
  orders,
  activo,
  onNavigateTab,
  onRefreshOrders,
}: {
  orders: readonly PedidoDelTablero[];
  /** Si la pestaña del tablero es la que se está viendo. */
  activo: boolean;
  onNavigateTab: (tab: Tab) => void;
  onRefreshOrders?: () => void;
}) {
  const { isAdmin } = useAuth();
  const [clave, setClave] = useState<ClaveDePeriodo>(periodoGuardado);
  const [ahora, setAhora] = useState(() => new Date());
  const [resumen, setResumen] = useState<ResumenDelTablero | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contarPruebas, setContarPruebas] = useState(false);
  const leidoEn = useRef(0);

  const periodo = useMemo(() => armarPeriodo(clave, ahora), [clave, ahora]);
  const hoy = diaDeArgentina(ahora);
  const deLaTienda = useMemo(() => soloDeLaTienda(orders), [orders]);
  // Cuando se acredita una compra nueva hay que volver a leer: su comisión viene en el resumen.
  const cobradas = useMemo(() => deLaTienda.filter((p) => estaPagado(p.status)).length, [deLaTienda]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    leerTablero(periodo.desde, periodo.hasta)
      .then((leido) => {
        if (cancelado) return;
        setResumen(leido);
        setError(null);
        leidoEn.current = Date.now();
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo leer el resumen de la tienda.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [periodo.desde, periodo.hasta, ahora, cobradas]);

  useEffect(() => {
    if (activo && leidoEn.current > 0 && Date.now() - leidoEn.current > VOLVER_A_LEER_MS) setAhora(new Date());
  }, [activo]);

  const elegirPeriodo = useCallback((nueva: ClaveDePeriodo) => {
    setClave(nueva);
    try {
      window.localStorage.setItem(CLAVE_DEL_PERIODO, nueva);
    } catch {
      // Sin almacenamiento el período vale para esta visita.
    }
  }, []);

  const actualizar = useCallback(() => {
    setAhora(new Date());
    onRefreshOrders?.();
  }, [onRefreshOrders]);

  const idsDePrueba = useMemo(() => new Set(resumen?.productosDePrueba ?? []), [resumen]);
  const esPrueba = useCallback((pedido: PedidoDelTablero) => esDePrueba(pedido, idsDePrueba), [idsDePrueba]);
  const dePrueba = useMemo(() => deLaTienda.filter(esPrueba), [deLaTienda, esPrueba]);
  const pedidos = useMemo(() => (contarPruebas ? deLaTienda : deLaTienda.filter((p) => !esPrueba(p))), [contarPruebas, deLaTienda, esPrueba]);
  const pagos = useMemo(() => pagosPorPedido(resumen?.pagos ?? []), [resumen]);
  const ventas = useMemo(() => resumirVentas(pedidos, pagos, periodo), [pedidos, pagos, periodo]);
  const ventasAntes = useMemo(() => resumirVentas(pedidos, pagos, periodo.anterior), [pedidos, pagos, periodo]);
  const enCurso = useMemo(() => pedidosEnCurso(pedidos), [pedidos]);
  const compras = useMemo(() => comprasDelRango(pedidos, periodo), [pedidos, periodo]);

  const visitas = resumen?.visitas ?? null;
  const visitasPorDia = useMemo(() => new Map((visitas?.porDia ?? []).map((d) => [d.dia, d])), [visitas]);

  if (!resumen && !error) return <p className="p-6 text-sm text-muted-foreground">Cargando el tablero</p>;

  const conversion = visitas && visitas.sesiones > 0 ? (ventas.compras / visitas.sesiones) * 100 : null;
  const conversionAntes = visitas && visitas.sesionesAntes > 0 ? (ventasAntes.compras / visitas.sesionesAntes) * 100 : null;
  const avisoDeGanancia = [
    ventas.sinComision > 0 ? `Falta la comisión de ${contar(ventas.sinComision, "pago", "pagos")} de Mercado Pago.` : null,
    ventas.conLineasSinCosto > 0 ? `${contar(ventas.conLineasSinCosto, "compra tiene", "compras tienen")} productos sin costo cargado.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const filasDeMedios: FilaConBarra[] = ventas.porMedio.map((m) => ({
    clave: m.medio,
    etiqueta: m.etiqueta,
    valor: m.cobrado,
    texto: pesos(m.cobrado),
    detalle: contar(m.compras, "compra", "compras"),
  }));
  const filasDeVendidos: FilaConBarra[] = ventas.masVendidos.map((p) => ({
    clave: p.clave,
    etiqueta: p.nombre,
    valor: p.facturado,
    texto: pesos(p.facturado),
    detalle: contar(p.unidades, "unidad", "unidades"),
  }));
  const filasDeVistos: FilaConBarra[] = (visitas?.productos ?? []).map((p) => ({
    clave: String(p.id),
    etiqueta: p.nombre,
    valor: p.sesiones,
    texto: entero(p.sesiones),
    marca: !p.publicado ? "Sin publicar" : !p.hayStock ? "Sin stock" : undefined,
  }));
  const filasDeOrigenes: FilaConBarra[] = (visitas?.origenes ?? []).map((o) => ({
    clave: o.origen,
    etiqueta: o.origen,
    valor: o.sesiones,
    texto: entero(o.sesiones),
    detalle: visitas && visitas.sesiones > 0 ? porcentaje((o.sesiones / visitas.sesiones) * 100) : undefined,
  }));
  const pasos: Array<{ clave: string; etiqueta: string; valor: number }> = visitas
    ? [
        { clave: "visitas", etiqueta: "Visitas", valor: visitas.sesiones },
        { clave: "producto", etiqueta: "Vieron un producto", valor: visitas.producto },
        { clave: "carrito", etiqueta: "Abrieron el carrito", valor: visitas.carrito },
        { clave: "checkout", etiqueta: "Empezaron a comprar", valor: visitas.checkout },
        { clave: "pedidos", etiqueta: "Hicieron el pedido", valor: ventas.creadas },
        { clave: "pagos", etiqueta: "Pagaron", valor: ventas.compras },
      ]
    : [];
  const filasDelRecorrido: FilaConBarra[] = pasos.map((paso, i) => ({
    ...paso,
    texto: entero(paso.valor),
    detalle: i > 0 && visitas && visitas.sesiones > 0 ? `${porcentaje((paso.valor / visitas.sesiones) * 100)} de las visitas` : undefined,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tablero</h1>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{etiquetaLargaDelDia(hoy)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={actualizar} disabled={cargando}>
          <RefreshCw className={cn(cargando && "animate-spin")} aria-hidden />
          Actualizar
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          No se pudieron leer las visitas, el catálogo ni las comisiones: {error.replace(/\.+$/, "")}. Los pedidos se muestran igual.
        </p>
      )}

      {dePrueba.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-border/80 bg-secondary/50 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {contarPruebas
              ? `El tablero está contando ${contar(dePrueba.length, "compra de prueba", "compras de prueba")}.`
              : dePrueba.length === 1
                ? "Hay 1 compra del producto de prueba que no se cuenta en el tablero."
                : `Hay ${dePrueba.length} compras del producto de prueba que no se cuentan en el tablero.`}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setContarPruebas((v) => !v)}>
            {contarPruebas ? "Dejar de contarlas" : "Contarlas"}
          </Button>
        </div>
      )}

      <section aria-labelledby="tablero-ahora" className="space-y-3">
        <h2 id="tablero-ahora" className="text-base font-bold text-foreground">
          Ahora
        </h2>
        <div className="grid gap-4 xl:grid-cols-12">
          <ParaHacer enCurso={enCurso} resumen={resumen} ahora={ahora} onIr={onNavigateTab} className="xl:col-span-5" />
          <PedidosEnCurso enCurso={enCurso} venceHoras={resumen?.pendienteVenceHoras ?? null} onIr={onNavigateTab} className="xl:col-span-3" />
          <CatalogoYPrecios resumen={resumen} ahora={ahora} onIr={onNavigateTab} className="xl:col-span-4" />
        </div>
      </section>

      <section aria-labelledby="tablero-periodo" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="tablero-periodo" className="text-base font-bold text-foreground">
              Ventas y visitas
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Del {etiquetaNumericaDelDia(periodo.desde)} al {etiquetaNumericaDelDia(periodo.hasta)}. Las variaciones comparan con {periodo.comparacion}.
            </p>
          </div>
          <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
            {PERIODOS.map((p) => (
              <button
                key={p.clave}
                type="button"
                aria-pressed={p.clave === clave}
                onClick={() => elegirPeriodo(p.clave)}
                className={cn(
                  "h-9 rounded-chip border px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  p.clave === clave ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground",
                )}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("space-y-4 transition-opacity", cargando && "opacity-60")} aria-busy={cargando}>
          <div className={cn("grid gap-4 sm:grid-cols-2", isAdmin ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
            <Indicador
              etiqueta="Ventas cobradas"
              valor={pesos(ventas.cobrado)}
              detalle={contar(ventas.compras, "compra", "compras")}
              variacion={variacion(ventas.cobrado, ventasAntes.cobrado)}
              comparacion={periodo.comparacion}
              sinComparacion={`Sin ventas en ${periodo.comparacion}.`}
            />
            {isAdmin && (
              <Indicador
                etiqueta="Ganancia bruta"
                valor={pesos(ventas.ganancia)}
                detalle={ventas.margen !== null ? `${porcentaje(ventas.margen)} de lo cobrado sin IVA` : "Sin IVA"}
                variacion={variacion(ventas.ganancia, ventasAntes.ganancia)}
                comparacion={periodo.comparacion}
                aviso={avisoDeGanancia || undefined}
              />
            )}
            <Indicador
              etiqueta="Ticket promedio"
              valor={ventas.ticket !== null ? pesos(ventas.ticket) : "Sin ventas"}
              variacion={ventas.ticket !== null && ventasAntes.ticket !== null ? variacion(ventas.ticket, ventasAntes.ticket) : null}
              comparacion={periodo.comparacion}
            />
            <Indicador
              etiqueta="Visitas"
              valor={visitas ? entero(visitas.sesiones) : "Sin dato"}
              detalle={visitas ? contar(visitas.vistas, "página vista", "páginas vistas") : undefined}
              variacion={visitas ? variacion(visitas.sesiones, visitas.sesionesAntes) : null}
              comparacion={periodo.comparacion}
              sinComparacion={visitas ? `Sin visitas en ${periodo.comparacion}.` : undefined}
            />
            <Indicador
              etiqueta="Visitas que compran"
              valor={conversion !== null ? porcentaje(conversion) : "Sin dato"}
              detalle={visitas && visitas.sesiones > 0 ? `${contar(ventas.compras, "compra", "compras")} sobre ${contar(visitas.sesiones, "visita", "visitas")}` : undefined}
              variacion={conversion !== null && conversionAntes !== null ? variacion(conversion, conversionAntes) : null}
              comparacion={periodo.comparacion}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <BarrasPorDia
              className="xl:col-span-8"
              titulo="Ventas por día"
              detalle="Lo cobrado cada día, por la fecha en que se acreditó el pago."
              datos={periodo.dias.map((dia) => {
                const delDia = ventas.porDia.get(dia);
                return { dia, valor: delDia?.cobrado ?? 0, detalle: delDia ? contar(delDia.compras, "compra", "compras") : "sin ventas" };
              })}
              hoy={hoy}
              queMide="Cobrado"
              formato={pesos}
              formatoDelEje={pesosCompactos}
              vacio="Todavía no hay ventas cobradas en este período."
            />
            <Tarjeta className="xl:col-span-4" titulo="Cómo pagaron" detalle="Lo cobrado por cada medio de pago.">
              <ListaConBarras filas={filasDeMedios} vacio="Sin ventas en este período." />
            </Tarjeta>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <BarrasPorDia
              className="xl:col-span-8"
              titulo="Visitas por día"
              detalle="Navegadores que abrieron la tienda cada día."
              datos={periodo.dias.map((dia) => {
                const delDia = visitasPorDia.get(dia);
                return { dia, valor: delDia?.sesiones ?? 0, detalle: delDia ? contar(delDia.vistas, "página vista", "páginas vistas") : "sin visitas" };
              })}
              hoy={hoy}
              queMide="Visitas"
              formato={(valor) => contar(valor, "visita", "visitas")}
              formatoDelEje={compacto}
              vacio={visitas ? "No hubo visitas en este período." : "No se pudieron leer las visitas."}
            />
            <Tarjeta className="xl:col-span-4" titulo="Recorrido de compra" detalle="Cuántas visitas llegan a cada paso.">
              <ListaConBarras filas={filasDelRecorrido} maximo={visitas?.sesiones} vacio="No se pudieron leer las visitas." />
            </Tarjeta>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <ComprasDelPeriodo className="xl:col-span-7" compras={compras} esDePrueba={esPrueba} ahora={ahora} onIr={onNavigateTab} />
            <Tarjeta className="xl:col-span-5" titulo="Lo más vendido" detalle="Por lo facturado en las compras cobradas.">
              <ListaConBarras filas={filasDeVendidos} vacio="Sin ventas en este período." />
            </Tarjeta>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <Tarjeta className="xl:col-span-7" titulo="Productos más vistos" detalle="Visitas que abrieron la ficha de cada producto.">
              <ListaConBarras filas={filasDeVistos} vacio={visitas ? "Nadie abrió la ficha de un producto en este período." : "No se pudieron leer las visitas."} />
            </Tarjeta>
            <Tarjeta className="xl:col-span-5" titulo="De dónde vienen las visitas" detalle="El origen de cada visita, cuando se puede saber.">
              <ListaConBarras filas={filasDeOrigenes} vacio={visitas ? "No hubo visitas en este período." : "No se pudieron leer las visitas."} />
            </Tarjeta>
          </div>

          <p className="text-xs text-muted-foreground">
            {isAdmin && "La ganancia bruta es sin IVA, después del costo de los productos, el envío y las comisiones de Mercado Pago. No descuenta Ingresos Brutos ni Ganancias. "}
            Las visitas cuentan los navegadores que abrieron la tienda, sin los del equipo; pueden incluir robots de buscadores.
          </p>
        </div>
      </section>
    </div>
  );
}
