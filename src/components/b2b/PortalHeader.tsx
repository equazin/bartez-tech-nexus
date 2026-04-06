import React from "react";
import {
  LogOut,
  Moon,
  RefreshCw,
  Search,
  ShoppingCart,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PortalHeaderProps {
  clientName: string;
  search: string;
  setSearch: (s: string) => void;
  currency: "USD" | "ARS";
  setCurrency: (c: "USD" | "ARS") => void;
  exchangeRate: { rate: number; updatedAt: string; source: "manual" | "api" };
  onRefreshRate: () => void;
  isFetchingRate: boolean;
  isDark: boolean;
  toggleTheme: () => void;
  themeFlash: boolean;
  themeSwitchReady: boolean;
  cartItemsCount: number;
  onOpenCart: () => void;
  onLogout: () => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  clientName,
  search,
  setSearch,
  currency,
  setCurrency,
  exchangeRate,
  onRefreshRate,
  isFetchingRate,
  isDark,
  toggleTheme,
  themeFlash,
  themeSwitchReady,
  cartItemsCount,
  onOpenCart,
  onLogout,
}) => {
  const ageMs = Date.now() - new Date(exchangeRate.updatedAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const ageLabel =
    ageMin < 2 ? "Ahora" : ageMin < 60 ? `hace ${ageMin}m` : `hace ${Math.floor(ageMin / 60)}h`;

  return (
    <header
      className="sticky top-0 z-40 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-xl md:px-6"
      style={{ "--header-height": "72px" } as React.CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* ── Logo / Identity ────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          <img
            src="/android-chrome-512x512.png"
            alt="Bartez"
            className="h-14 w-14 shrink-0 rounded-2xl object-contain"
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-foreground">Portal B2B</span>
              <Badge variant="muted" className="hidden rounded-full lg:inline-flex">
                Cuenta operativa
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{clientName}</p>
          </div>
        </div>

        {/* ── Search (flex-grow so it fills available space) ────────── */}
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Buscar productos, SKU o marca…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 rounded-2xl border-border/80 bg-surface pl-10 pr-10 text-sm shadow-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        {/* ── Right controls ────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-2">
          {/* Currency toggle */}
          <div className="flex items-center gap-1 rounded-full border border-border/70 bg-surface p-1">
            {(["USD", "ARS"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCurrency(item)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                  currency === item
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            className={cn(
              "group relative h-9 w-[88px] shrink-0 overflow-hidden rounded-full border border-border/70 bg-surface transition-all duration-300",
              themeFlash ? "shadow-[0_0_0_3px_rgba(94,234,212,0.22)]" : "",
              themeSwitchReady ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
              <Moon
                size={12}
                className={cn("transition", isDark ? "text-foreground" : "text-muted-foreground/50")}
              />
            </span>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <Sun
                size={12}
                className={cn("transition", isDark ? "text-muted-foreground/50" : "text-amber-500")}
              />
            </span>
            <span
              className={cn(
                "pointer-events-none absolute left-[3px] top-[3px] h-7 w-7 rounded-full bg-card shadow-md transition-transform duration-300",
                isDark ? "translate-x-[2px]" : "translate-x-[54px]",
              )}
            />
          </button>

          {/* Exchange rate chip */}
          <div className="hidden items-center gap-2 rounded-[24px] border border-border/70 bg-surface px-3 py-2 text-xs xl:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <TrendingUp size={13} />
            </div>
            <div className="leading-none">
              <p className="font-semibold text-foreground">
                $ {exchangeRate.rate.toLocaleString("es-AR")}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">oficial</span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {exchangeRate.source === "api" ? ageLabel : "manual"}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshRate}
              disabled={isFetchingRate}
              className="rounded-xl p-1 text-muted-foreground transition hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              title="Actualizar cotización"
            >
              <RefreshCw size={11} className={isFetchingRate ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Cart */}
          <Button
            type="button"
            onClick={onOpenCart}
            variant={cartItemsCount > 0 ? "default" : "outline"}
            className={cn(
              "h-11 gap-2 rounded-2xl px-4",
              cartItemsCount > 0 ? "shadow-lg shadow-primary/20" : "bg-surface",
            )}
          >
            <ShoppingCart
              size={15}
              className={cartItemsCount > 0 ? "animate-bounce-short" : ""}
            />
            <span className="hidden text-xs font-semibold md:inline">Carrito</span>
            {cartItemsCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold text-primary">
                {cartItemsCount}
              </span>
            ) : null}
          </Button>
          
          <Button
            type="button"
            onClick={onLogout}
            variant="ghost"
            title="Cerrar sesión"
            className="h-11 w-11 rounded-2xl p-0 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
};
