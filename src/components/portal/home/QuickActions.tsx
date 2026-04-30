import { ShoppingBag, FileText, Package, MessageSquare, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTIONS: Action[] = [
  { label: "Nuevo pedido",     icon: <ShoppingBag className="h-4 w-4" />,   path: "/portal/catalogo" },
  { label: "Nueva cotización", icon: <FileText className="h-4 w-4" />,      path: "/portal/cotizaciones/express" },
  { label: "Mis pedidos",      icon: <Package className="h-4 w-4" />,       path: "/portal/pedidos" },
  { label: "Importar pedido",  icon: <Upload className="h-4 w-4" />,        path: "/portal/pedidos/bulk" },
  { label: "Soporte",          icon: <MessageSquare className="h-4 w-4" />, path: "/portal/soporte" },
  { label: "Cotizador rápido", icon: <Zap className="h-4 w-4" />,           path: "/portal/cotizaciones/express" },
];

interface Props {
  onNavigate: (path: string) => void;
}

export function QuickActions({ onNavigate }: Props) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Acciones rápidas</p>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.label}
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onNavigate(a.path)}
          >
            {a.icon}
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
