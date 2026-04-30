import * as React from "react";
import { Link } from "react-router-dom";
import { Menu, Search, ShoppingCart, Sun, Moon, ChevronDown, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrency } from "@/context/CurrencyContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { cn } from "@/lib/utils";

interface TopBarProps {
  /** Cart item count badge */
  cartCount?: number;
  /** Optional alerts/notifications count */
  alertCount?: number;
  /** Available credit ratio 0..1 (used + total) */
  creditUsedPct?: number;
  creditAvailable?: number;
  creditTotal?: number;
  /** Callback to open the command palette */
  onOpenCommand?: () => void;
  /** Callback to open the cart sheet */
  onOpenCart?: () => void;
  /** Callback to toggle sidebar (mobile) */
  onToggleSidebar?: () => void;
  /** Optional rightmost slot (profile dropdown) */
  rightSlot?: React.ReactNode;
}

function TopBar({
  cartCount = 0,
  alertCount = 0,
  creditUsedPct,
  creditAvailable,
  creditTotal,
  onOpenCommand,
  onOpenCart,
  onToggleSidebar,
  rightSlot,
}: TopBarProps) {
  const { currency, setCurrency, formatPrice } = useCurrency();
  const { theme, toggleTheme } = useAppTheme();
  const isDark = theme === "dark";

  const creditTone =
    typeof creditUsedPct === "number"
      ? creditUsedPct >= 0.9
        ? "danger"
        : creditUsedPct >= 0.75
          ? "warning"
          : "success"
      : null;

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onToggleSidebar}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Link
        to="/portal"
        className="hidden items-center gap-2 pr-2 md:inline-flex"
        aria-label="Ir al inicio"
      >
        <span className="font-display text-[18px] font-bold tracking-tight text-foreground">Bartez</span>
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">B2B</span>
      </Link>

      <button
        type="button"
        onClick={onOpenCommand}
        className={cn(
          "flex h-9 max-w-2xl flex-1 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 text-left text-[13px] text-muted-foreground transition-colors",
          "hover:border-brand/40 hover:bg-card/90",
        )}
        aria-label="Buscar (Ctrl/Cmd+K)"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 truncate">Buscar SKU, pedido, factura...</span>
        <kbd className="hidden items-center gap-1 rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {/* Currency toggle */}
        <div
          role="group"
          aria-label="Moneda"
          className="hidden items-center rounded-lg border border-border/70 bg-card p-0.5 sm:flex"
        >
          {(["USD", "ARS"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-semibold transition-colors portal-tabular",
                currency === c ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Credit chip */}
        {typeof creditAvailable === "number" && typeof creditTotal === "number" && creditTotal > 0 ? (
          <div
            className={cn(
              "hidden items-center gap-2 rounded-lg border px-2.5 py-1 lg:flex",
              creditTone === "danger" && "border-danger/40 bg-danger-soft text-danger",
              creditTone === "warning" && "border-warning/40 bg-warning-soft text-warning",
              creditTone === "success" && "border-border/70 bg-card text-foreground",
              !creditTone && "border-border/70 bg-card text-foreground",
            )}
            title={`Crédito disponible: ${formatPrice(creditAvailable, "USD")} de ${formatPrice(creditTotal, "USD")}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Crédito</span>
            <span className="text-[12px] font-semibold portal-tabular">{formatPrice(creditAvailable, "USD")}</span>
          </div>
        ) : null}

        {/* Notifications */}
        <Button type="button" variant="ghost" size="icon" aria-label="Notificaciones" className="relative">
          <Bell className="h-[18px] w-[18px]" />
          {alertCount > 0 ? (
            <span className="absolute right-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-danger-foreground portal-tabular">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          ) : null}
        </Button>

        {/* Theme toggle */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a claro" : "Cambiar a oscuro"}
        >
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </Button>

        {/* Cart */}
        <Button type="button" variant="ghost" size="icon" onClick={onOpenCart} className="relative" aria-label="Carrito">
          <ShoppingCart className="h-[18px] w-[18px]" />
          {cartCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground portal-tabular">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          ) : null}
        </Button>

        {rightSlot ? <div className="ml-1 flex items-center">{rightSlot}</div> : null}
      </div>
    </header>
  );
}

export { TopBar };
