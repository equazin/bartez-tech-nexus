import type { ReactNode } from "react";
import { ShoppingBag, FileText, Package, MessageSquare, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  icon: ReactNode;
  path: string;
}

const ACTIONS: Action[] = [
  { label: "Nuevo pedido", icon: <ShoppingBag className="h-4 w-4" />, path: "/portal/catalogo" },
  { label: "Nueva cotización", icon: <FileText className="h-4 w-4" />, path: "/portal/cotizaciones/express" },
  { label: "Mis pedidos", icon: <Package className="h-4 w-4" />, path: "/portal/pedidos" },
  { label: "Importar pedido", icon: <Upload className="h-4 w-4" />, path: "/portal/pedidos/bulk" },
  { label: "Soporte", icon: <MessageSquare className="h-4 w-4" />, path: "/portal/soporte" },
  { label: "Cotizador rápido", icon: <Zap className="h-4 w-4" />, path: "/portal/cotizaciones/express" },
];

const PRIMARY_ACTION = ACTIONS[0];
const SECONDARY_ACTIONS = ACTIONS.slice(1);

interface Props {
  onNavigate: (path: string) => void;
}

export function QuickActions({ onNavigate }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Acciones rápidas</p>
      <div className="grid gap-2 lg:grid-cols-[minmax(210px,0.8fr)_1fr]">
        <Button
          variant="default"
          size="default"
          className="h-11 justify-start gap-2 px-4"
          onClick={() => onNavigate(PRIMARY_ACTION.path)}
        >
          {PRIMARY_ACTION.icon}
          {PRIMARY_ACTION.label}
        </Button>

        <div className="flex flex-wrap gap-2">
          {SECONDARY_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="toolbar"
              size="sm"
              className="h-11 gap-1.5 px-3"
              onClick={() => onNavigate(action.path)}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
