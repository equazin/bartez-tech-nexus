import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Package,
  ShoppingCart,
  FileText,
  User,
  LifeBuoy,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface SidebarNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Optional sub-items rendered when the parent route is active */
  children?: Array<{ label: string; to: string; badge?: string | number }>;
  /** Restrict to roles (e.g. "manager", "admin"). If undefined, visible to all. */
  roles?: string[];
  badge?: string | number;
}

export const portalNavItems: SidebarNavItem[] = [
  { label: "Inicio", to: "/portal", icon: Home },
  {
    label: "Catálogo",
    to: "/portal/catalogo",
    icon: Package,
    children: [
      { label: "Todos", to: "/portal/catalogo" },
      { label: "Bundles", to: "/portal/catalogo/bundles" },
      { label: "Armador PC", to: "/portal/catalogo/configurador" },
    ],
  },
  {
    label: "Pedidos",
    to: "/portal/pedidos",
    icon: ShoppingCart,
  },
  {
    label: "Cotizaciones",
    to: "/portal/cotizaciones",
    icon: FileText,
  },
  {
    label: "Mi cuenta",
    to: "/portal/cuenta",
    icon: User,
    children: [
      { label: "Resumen", to: "/portal/cuenta" },
      { label: "Documentos", to: "/portal/cuenta/documentos" },
      { label: "Listas guardadas", to: "/portal/cuenta/listas" },
      { label: "Reposición auto.", to: "/portal/cuenta/reposicion" },
      { label: "Proyectos", to: "/portal/cuenta/proyectos" },
      { label: "Devoluciones", to: "/portal/cuenta/rma" },
      { label: "Crédito", to: "/portal/cuenta/credito" },
      { label: "Reportes", to: "/portal/cuenta/reportes" },
      { label: "Lealtad", to: "/portal/cuenta/lealtad" },
      { label: "Empresa", to: "/portal/cuenta/empresa" },
      { label: "Usuarios", to: "/portal/cuenta/usuarios" },
      { label: "Sucursales", to: "/portal/cuenta/sucursales" },
      { label: "Notificaciones", to: "/portal/cuenta/notificaciones" },
    ],
  },
  { label: "Soporte", to: "/portal/soporte", icon: LifeBuoy },
];

interface SidebarNavProps {
  collapsed?: boolean;
  role?: string;
  className?: string;
  onNavigate?: () => void;
}

function isParentActive(pathname: string, item: SidebarNavItem): boolean {
  if (item.to === "/portal") return pathname === "/portal";
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function SidebarNav({ collapsed = false, role, className, onNavigate }: SidebarNavProps) {
  const location = useLocation();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <nav className={cn("flex flex-col gap-0.5 px-2 py-3", className)} aria-label="Portal navigation">
      {portalNavItems
        .filter((item) => !item.roles || (role && item.roles.includes(role)))
        .map((item) => {
          const Icon = item.icon;
          const parentActive = isParentActive(location.pathname, item);
          const isExpanded = expanded[item.label] ?? parentActive;
          const hasChildren = !!item.children?.length;

          return (
            <div key={item.to} className="flex flex-col">
              <NavLink
                to={item.to}
                end={item.to === "/portal"}
                onClick={() => {
                  if (hasChildren && !collapsed) toggleExpand(item.label);
                  onNavigate?.();
                }}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
                    "hover:bg-secondary hover:text-foreground",
                    (isActive && !hasChildren) || (parentActive && hasChildren)
                      ? "bg-brand/10 text-brand"
                      : "text-muted-foreground",
                    collapsed && "justify-center",
                  )
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined ? (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand portal-tabular">
                        {item.badge}
                      </span>
                    ) : null}
                    {hasChildren ? (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180",
                        )}
                      />
                    ) : null}
                  </>
                )}
              </NavLink>

              {!collapsed && hasChildren && isExpanded ? (
                <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-3">
                  {item.children!.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors",
                          isActive
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )
                      }
                    >
                      <span className="truncate">{child.label}</span>
                      {child.badge !== undefined ? (
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] portal-tabular">
                          {child.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
    </nav>
  );
}

export { SidebarNav };
