type TimelineStep = {
  key: string;
  label: string;
  helper: string;
  state: "done" | "current" | "upcoming" | "blocked";
};

const ORDER_TIMELINE_BY_STATUS: Record<string, TimelineStep[]> = {
  pending: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Stock y condiciones", state: "current" },
    { key: "approved", label: "Aprobado", helper: "Listo para preparar", state: "upcoming" },
    { key: "dispatch", label: "Con remito", helper: "Despacho o retiro", state: "upcoming" },
    { key: "invoice", label: "Facturado", helper: "Factura emitida", state: "upcoming" },
  ],
  approved: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Stock y condiciones", state: "done" },
    { key: "approved", label: "Aprobado", helper: "Pedido confirmado", state: "current" },
    { key: "dispatch", label: "Con remito", helper: "Despacho o retiro", state: "upcoming" },
    { key: "invoice", label: "Facturado", helper: "Factura emitida", state: "upcoming" },
  ],
  preparing: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Stock y condiciones", state: "done" },
    { key: "approved", label: "Aprobado", helper: "Pedido confirmado", state: "done" },
    { key: "dispatch", label: "Con remito", helper: "Armado en curso", state: "current" },
    { key: "invoice", label: "Facturado", helper: "Factura emitida", state: "upcoming" },
  ],
  dispatched: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Stock y condiciones", state: "done" },
    { key: "approved", label: "Aprobado", helper: "Pedido confirmado", state: "done" },
    { key: "dispatch", label: "Con remito", helper: "Ya salió de depósito", state: "current" },
    { key: "invoice", label: "Facturado", helper: "Pendiente de emisión", state: "upcoming" },
  ],
  shipped: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Stock y condiciones", state: "done" },
    { key: "approved", label: "Aprobado", helper: "Pedido confirmado", state: "done" },
    { key: "dispatch", label: "Con remito", helper: "Transporte en curso", state: "done" },
    { key: "invoice", label: "Facturado", helper: "Pendiente de emisión", state: "current" },
  ],
  delivered: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Stock y condiciones", state: "done" },
    { key: "approved", label: "Aprobado", helper: "Pedido confirmado", state: "done" },
    { key: "dispatch", label: "Con remito", helper: "Entregado", state: "done" },
    { key: "invoice", label: "Facturado", helper: "Administración", state: "current" },
  ],
  rejected: [
    { key: "created", label: "Pedido creado", helper: "Recibido por Bartez", state: "done" },
    { key: "review", label: "En revisión", helper: "Se revisó el pedido", state: "blocked" },
    { key: "approved", label: "Aprobado", helper: "No aprobado", state: "blocked" },
    { key: "dispatch", label: "Con remito", helper: "Sin despacho", state: "blocked" },
    { key: "invoice", label: "Facturado", helper: "Sin emisión", state: "blocked" },
  ],
};

function stateClasses(state: TimelineStep["state"]) {
  if (state === "done") {
    return {
      dot: "bg-[#2D9F6A] border-[#2D9F6A]",
      line: "bg-[#2D9F6A]",
      label: "text-[#2D9F6A]",
      helper: "text-gray-500",
    };
  }
  if (state === "current") {
    return {
      dot: "bg-amber-400 border-amber-400",
      line: "bg-[#2a2a2a]",
      label: "text-amber-400",
      helper: "text-gray-500",
    };
  }
  if (state === "blocked") {
    return {
      dot: "bg-red-400 border-red-400",
      line: "bg-[#2a2a2a]",
      label: "text-red-400",
      helper: "text-gray-500",
    };
  }
  return {
    dot: "bg-transparent border-[#404040]",
    line: "bg-[#2a2a2a]",
    label: "text-gray-400",
    helper: "text-gray-500",
  };
}

export function OrderStatusTimeline({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const steps = ORDER_TIMELINE_BY_STATUS[status] ?? ORDER_TIMELINE_BY_STATUS.pending;

  return (
    <div className={`grid gap-3 ${compact ? "md:grid-cols-5" : ""}`}>
      {steps.map((step, index) => {
        const classes = stateClasses(step.state);
        const isLast = index === steps.length - 1;
        return (
          <div key={step.key} className="relative flex items-start gap-3">
            <div className="relative flex flex-col items-center pt-0.5">
              <span className={`h-3 w-3 rounded-full border ${classes.dot}`} />
              {!isLast && <span className={`mt-1 h-8 w-px ${classes.line}`} />}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${classes.label}`}>{step.label}</p>
              <p className={`text-[11px] ${classes.helper}`}>{step.helper}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
