import React, { useEffect, useRef } from "react";
import {
  CreditCard,
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

type PartnerLevel = "cliente" | "silver" | "gold" | "platinum";

const PARTNER_BADGE: Record<PartnerLevel, { label: string; icon: string; class: string } | null> = {
  cliente: null,
  silver: { label: "Silver Partner", icon: "⭐", class: "border-slate-400/30 bg-slate-500/10 text-slate-500" },
  gold: { label: "Gold Partner", icon: "🏆", class: "border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  platinum: { label: "Platinum Partner", icon: "💎", class: "border-violet-400/30 bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

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
  cartTotal?: number;
  onOpenCart: () => void;
  onLogout: () => void;
  creditLimit?: number;
  creditAvailable?: number;
  partnerLevel?: string;
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
  cartTotal,
  onOpenCart,
  onLogout,
  creditLimit,
  creditAvailable,
  partnerLevel,
}) => {
  const effectiveLevel = (partnerLevel as PartnerLevel) || "cliente";
  const partnerBadge = PARTNER_BADGE[effectiveLevel] ?? null;
  const ageMs = Date.now() - new Date(exchangeRate.updatedAt).getTime();
  const ageMin = Math.floor(ageMs / 60000);
  const ageLabel =
    ageMin < 2 ? "Ahora" : ageMin < 60 ? `hace ${ageMin}m` : `hace ${Math.floor(ageMin / 60)}h`;
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = headerRef.current;
    if (!node) return;

    const updateHeaderHeight = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--header-height", `${height}px`);
    };

    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(node);
    window.addEventListener("resize", updateHeaderHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeaderHeight);
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        {/* ── Logo / Identity ────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3">
          <img
            src="/android-chrome-512x512.png"
            alt="Bartez"
            className="h-12 w-12 shrink-0 rounded-2xl object-contain md:h-14 md:w-14"
          />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-foreground">Portal B2B</span>
              {partnerBadge && (
                <span className={cn(
                  "hidden items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold lg:inline-flex",
                  partnerBadge.class,
                )}>
                  <span>{partnerBadge.icon}</span>
                  {partnerBadge.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{clientName}</p>
          </div>
        </div>

        {/* ── Search (flex-grow so it fills available space) ────────── */}
        <div className="relative min-w-0 w-full">
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
        <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:flex-nowrap lg:justify-end">
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

          {/* Exchange rate chip — visible desde md */}
          <div className="hidden items-center gap-2 rounded-[24px] border border-border/70 bg-surface px-3 py-2 text-xs md:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <TrendingUp size={12} />
            </div>
            <div className="leading-none">
              <p className="font-semibold text-foreground tabular-nums">
                $ {exchangeRate.rate.toLocaleString("es-AR")}
                <span className="ml-1 hidden text-[10px] font-normal text-muted-foreground xl:inline">oficial</span>
              </p>
              <p className="mt-0.5 hidden text-[10px] text-muted-foreground xl:block">
                {exchangeRate.source === "api" ? ageLabel : "manual"}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshRate}
              disabled={isFetchingRate}
              className="hidden rounded-xl p-1 text-muted-foreground transition hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 xl:block"
              title="Actualizar cotización"
            >
              <RefreshCw size={11} className={isFetchingRate ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Credit chip */}
          {creditLimit != null && creditLimit > 0 && creditAvailable != null && (() => {
            const pct = Math.min(100, ((creditLimit - creditAvailable) / creditLimit) * 100);
            const danger = pct >= 80;
            const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
            return (
              <div className={cn(
                "hidden items-center gap-2 rounded-[24px] border px-3 py-2 text-xs xl:flex",
                danger
                  ? "border-destructive/30 bg-destructive/10"
                  : "border-border/70 bg-surface",
              )}>
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-2xl",
                  danger ? "bg-destructive/20 text-destructive" : "bg-accent text-accent-foreground",
                )}>
                  <CreditCard size={13} />
                </div>
                <div className="leading-none">
                  <p className={cn("font-semibold", danger ? "text-destructive" : "text-foreground")}>
                    {fmt(creditAvailable)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ {fmt(creditLimit)}</span>
                  </p>
                  <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", danger ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Cart */}
          <Button
            type="button"
            onClick={onOpenCart}
            variant={cartItemsCount > 0 ? "default" : "outline"}
            className={cn(
              "h-10 gap-2 rounded-2xl px-3 sm:h-11 sm:px-4",
              cartItemsCount > 0 ? "shadow-lg shadow-primary/20" : "bg-surface",
            )}
          >
            <ShoppingCart
              size={15}
              className={cartItemsCount > 0 ? "animate-bounce-short" : ""}
            />
            <span className="hidden text-xs font-semibold sm:inline">Carrito</span>
            {cartItemsCount > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold text-primary">
                {cartItemsCount}
              </span>
            ) : null}
            {cartItemsCount > 0 && cartTotal != null && cartTotal > 0 ? (
              <span className="hidden text-[10px] font-semibold tabular-nums opacity-85 sm:inline">
                ${Math.round(cartTotal).toLocaleString("es-AR")}
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
