import { AlertTriangle, Banknote, FileText, FlaskConical, Package, RotateCcw, Tag, Truck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tab } from "@/components/admin/layout/adminNavConfig";
import type { ResumenDelTablero } from "@/lib/api/tablero";
import { contar, pesos } from "@/lib/panel/formatos";
import { haceCuanto } from "@/lib/panel/periodos";
import type { PedidosEnCurso } from "@/lib/panel/ventas";
import { Tarjeta, Vacio } from "./piezas";

interface Pendiente {
  clave: string;
  icono: LucideIcon;
  titulo: string;
  detalle: string;
  destino: Tab;
  boton: string;
  /** Algo que anda mal, no solo trabajo por hacer. */
  alerta?: boolean;
}

/** La sincronización corre dos veces por día: pasado este tiempo sin terminar, se perdió más de una corrida. */
const HORAS_SIN_SINCRONIZAR = 26;

/** "La más vieja se pagó hace 3 h." Sin fecha no dice nada. */
function desdeCuando(inicio: string, fecha: string | null, ahora: Date): string {
  const hace = haceCuanto(fecha, ahora);
  return hace ? `${inicio} ${hace}.` : "";
}

function armarPendientes(enCurso: PedidosEnCurso, resumen: ResumenDelTablero | null, ahora: Date): Pendiente[] {
  const pendientes: Pendiente[] = [];
  const { esperandoTransferencia, pagados, enPreparacion, sinFactura } = enCurso;

  if (esperandoTransferencia.cantidad > 0) {
    pendientes.push({
      clave: "transferencias",
      icono: Banknote,
      titulo: contar(esperandoTransferencia.cantidad, "transferencia por confirmar", "transferencias por confirmar"),
      detalle: `${pesos(esperandoTransferencia.total)} en espera. ${desdeCuando("El pedido más viejo se hizo", esperandoTransferencia.masViejo, ahora)}`.trim(),
      destino: "pagos",
      boton: "Ir a Pagos",
    });
  }
  if (pagados.cantidad > 0) {
    pendientes.push({
      clave: "pagados",
      icono: Package,
      titulo: contar(pagados.cantidad, "compra pagada para preparar", "compras pagadas para preparar"),
      detalle: desdeCuando("La más vieja se pagó", pagados.masViejo, ahora) || "Ya están cobradas.",
      destino: "orders",
      boton: "Ir a Pedidos",
    });
  }
  if (enPreparacion.cantidad > 0) {
    pendientes.push({
      clave: "preparacion",
      icono: Truck,
      titulo: contar(enPreparacion.cantidad, "compra en preparación sin despachar", "compras en preparación sin despachar"),
      detalle: desdeCuando("La más vieja pasó a preparación", enPreparacion.masViejo, ahora) || "Todavía no se despacharon.",
      destino: "orders",
      boton: "Ir a Pedidos",
    });
  }
  if (sinFactura.cantidad > 0) {
    pendientes.push({
      clave: "facturas",
      icono: FileText,
      titulo: contar(sinFactura.cantidad, "compra pagada sin factura", "compras pagadas sin factura"),
      detalle: "El PDF de la factura se sube en Pagos, en Facturas de la tienda.",
      destino: "pagos",
      boton: "Ir a Pagos",
    });
  }
  if (!resumen) return pendientes;

  if (resumen.arrepentimientosAbiertos > 0) {
    pendientes.push({
      clave: "arrepentimientos",
      icono: RotateCcw,
      titulo: contar(resumen.arrepentimientosAbiertos, "pedido de arrepentimiento sin cerrar", "pedidos de arrepentimiento sin cerrar"),
      detalle: "Esperan una respuesta.",
      destino: "arrepentimientos",
      boton: "Ver",
    });
  }

  const sincronizacion = resumen.sincronizacion;
  const conFalla = sincronizacion?.mayoristas.filter((m) => m.estado !== "ok").map((m) => m.nombre) ?? [];
  const horasSinCorrer = sincronizacion?.termino ? (ahora.getTime() - new Date(sincronizacion.termino).getTime()) / 3_600_000 : null;
  if (conFalla.length > 0) {
    pendientes.push({
      clave: "sincronizacion-falla",
      icono: AlertTriangle,
      titulo: `La última sincronización con ${conFalla.join(" y ")} no terminó bien`,
      detalle: "Los costos y el stock de ese mayorista pueden estar desactualizados.",
      destino: "dolar",
      boton: "Revisar",
      alerta: true,
    });
  } else if (horasSinCorrer !== null && horasSinCorrer > HORAS_SIN_SINCRONIZAR) {
    pendientes.push({
      clave: "sincronizacion-vieja",
      icono: AlertTriangle,
      titulo: `Los costos y el stock no se sincronizan ${haceCuanto(sincronizacion?.termino, ahora)}`,
      detalle: "La sincronización con los mayoristas corre sola dos veces por día.",
      destino: "dolar",
      boton: "Revisar",
      alerta: true,
    });
  }

  if (resumen.catalogo.sinPrecio > 0) {
    pendientes.push({
      clave: "sin-precio",
      icono: Tag,
      titulo: contar(resumen.catalogo.sinPrecio, "producto publicado sin precio", "productos publicados sin precio"),
      detalle: "Sin precio no se pueden comprar.",
      destino: "products",
      boton: "Ir a Productos",
      alerta: true,
    });
  }
  if (resumen.catalogo.dePrueba > 0) {
    pendientes.push({
      clave: "producto-de-prueba",
      icono: FlaskConical,
      titulo: resumen.catalogo.dePrueba === 1 ? "Hay un producto de prueba publicado" : `Hay ${resumen.catalogo.dePrueba} productos de prueba publicados`,
      detalle: "No sale en los buscadores, pero cualquiera con el enlace lo puede comprar. Despublicalo cuando termines de probar.",
      destino: "products",
      boton: "Ir a Productos",
    });
  }
  return pendientes;
}

/** Lo que está esperando una acción ahora, sin importar el período elegido. */
export function ParaHacer({
  enCurso,
  resumen,
  ahora,
  onIr,
  className,
}: {
  enCurso: PedidosEnCurso;
  resumen: ResumenDelTablero | null;
  ahora: Date;
  onIr: (tab: Tab) => void;
  className?: string;
}) {
  const pendientes = armarPendientes(enCurso, resumen, ahora);
  return (
    <Tarjeta titulo="Para hacer" detalle={pendientes.length > 0 ? "Lo que está esperando una acción." : undefined} className={className}>
      {pendientes.length === 0 ? (
        <Vacio>No hay nada pendiente.</Vacio>
      ) : (
        <ul className="divide-y divide-border/70">
          {pendientes.map(({ clave, icono: Icono, titulo, detalle, destino, boton, alerta }) => (
            <li key={clave} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", alerta ? "bg-danger-soft text-danger" : "bg-secondary text-foreground")}>
                <Icono size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-bold text-foreground">{titulo}</p>
                <p className="text-xs text-muted-foreground">{detalle}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onIr(destino)}>
                {boton}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}
