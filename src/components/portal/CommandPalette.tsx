import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  Package,
  ShoppingCart,
  FileText,
  User,
  LifeBuoy,
  Repeat,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CmdAction {
  id: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  shortcut?: string;
  group: "Ir a" | "Acciones";
  onSelect?: () => void;
}

function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  const go = React.useCallback(
    (to: string) => {
      onOpenChange(false);
      navigate(to);
    },
    [navigate, onOpenChange],
  );

  const actions = React.useMemo<CmdAction[]>(
    () => [
      { id: "go-home", label: "Inicio", icon: Home, to: "/portal", group: "Ir a", shortcut: "G H" },
      { id: "go-catalog", label: "Catálogo", icon: Package, to: "/portal/catalogo", group: "Ir a", shortcut: "G C" },
      { id: "go-orders", label: "Pedidos", icon: ShoppingCart, to: "/portal/pedidos", group: "Ir a", shortcut: "G O" },
      { id: "go-quotes", label: "Cotizaciones", icon: FileText, to: "/portal/cotizaciones", group: "Ir a", shortcut: "G Q" },
      { id: "go-account", label: "Mi cuenta", icon: User, to: "/portal/cuenta", group: "Ir a", shortcut: "G A" },
      { id: "go-support", label: "Soporte", icon: LifeBuoy, to: "/portal/soporte", group: "Ir a" },
      { id: "act-fast-order", label: "Cargar pedido por SKU", icon: ShoppingCart, to: "/portal/pedidos?action=fast-order", group: "Acciones" },
      { id: "act-quote", label: "Pedir cotización rápida", icon: FileText, to: "/portal/cotizaciones?action=express", group: "Acciones" },
      { id: "act-repeat", label: "Reagregar último pedido", icon: Repeat, to: "/portal/pedidos?action=repeat-last", group: "Acciones" },
    ],
    [],
  );

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar SKU, pedido, factura, sección..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Ir a">
          {actions
            .filter((a) => a.group === "Ir a")
            .map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem
                  key={a.id}
                  onSelect={() => {
                    if (a.onSelect) a.onSelect();
                    else if (a.to) go(a.to);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                  {a.shortcut ? <CommandShortcut>{a.shortcut}</CommandShortcut> : null}
                </CommandItem>
              );
            })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Acciones rápidas">
          {actions
            .filter((a) => a.group === "Acciones")
            .map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem
                  key={a.id}
                  onSelect={() => {
                    if (a.onSelect) a.onSelect();
                    else if (a.to) go(a.to);
                  }}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export { CommandPalette };
