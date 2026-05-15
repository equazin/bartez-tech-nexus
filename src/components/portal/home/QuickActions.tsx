import type { ReactNode } from "react";
import { ShoppingBag, FileText, Package, MessageSquare, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  icon: ReactNode;
  path: string;
}

const PRIMARY_ACTION: Action = {
  label: "Nuevo pedido",
  icon: <ShoppingBag className="h-4 w-4" />,
  path: "/portal/catalogo",
};

const SECONDARY_ACTIONS: Action[] = [
  { label: "Cotización", icon: <FileText className="h-4 w-4" />, path: "/portal/cotizaciones/express" },
  { label: "Mis pedidos", icon: <Package className="h-4 w-4" />, path: "/portal/pedidos" },
  { label: "Importar", icon: <Upload className="h-4 w-4" />, path: "/portal/pedidos/bulk" },
  { label: "Soporte", icon: <MessageSquare className="h-4 w-4" />, path: "/portal/cuenta/soporte" },
];

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
          className="h-11 w-full justify-start gap-2 px-4"
          onClick={() => onNavigate(PRIMARY_ACTION.path)}
        >
          {PRIMARY_ACTION.icon}
          {PRIMARY_ACTION.label}
        </Button>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {SECONDARY_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="toolbar"
              size="sm"
              className="h-11 justify-start gap-1.5 px-3 sm:justify-center"
              onClick={() => onNavigate(action.path)}
            >
              {action.icon}
              <span className="truncate">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
