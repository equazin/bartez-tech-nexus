import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
export type Currency = "USD" | "ARS";

export interface ExchangeRate {
  rate: number;        // USD → ARS
  source: "manual" | "api";
  updatedAt: string;   // ISO date string
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  exchangeRate: ExchangeRate;
  setExchangeRate: (r: ExchangeRate) => void;
  /** Convert a USD value to the active currency */
  convertPrice: (usdValue: number) => number;
  /** Format a USD value into the active currency string */
  formatPrice: (usdValue: number) => string;
  /** Always format as USD regardless of active currency */
  formatUSD: (usdValue: number) => string;
  /** Always format as ARS regardless of active currency */
  formatARS: (usdValue: number) => string;
  /** Fetch rate from external API */
  fetchExchangeRate: () => Promise<void>;
  /** Whether a fetch is in progress */
  isFetchingRate: boolean;
  /** Last fetch error message, null if none */
  fetchRateError: string | null;
}

// How old a cached rate can be before auto-refreshing (6 hours)
const RATE_TTL_MS = 6 * 60 * 60 * 1000;

// ── Storage keys ───────────────────────────────────────────────────────────
const CURRENCY_KEY     = "bartez_currency";
const EXCHANGE_KEY     = "bartez_exchange_rate";
const DEFAULT_RATE: ExchangeRate = {
  rate: 1300,
  source: "manual",
  updatedAt: new Date().toISOString(),
};

// ── Formatters ─────────────────────────────────────────────────────────────
/**
 * Format a USD amount.
 * USD 1200      →  "USD 1,200"
 * ARS 1200*1300 →  "$ 1.560.000"
 */
function fmtUSD(value: number): string {
  const rounded = Math.round(value);
  return "USD " + rounded.toLocaleString("en-US");
}

function fmtARS(usdValue: number, rate: number): string {
  const ars = Math.round(usdValue * rate);
  return "$ " + ars.toLocaleString("es-AR");
}

// ── Context ────────────────────────────────────────────────────────────────
const CurrencyContext = createContext<CurrencyContextType | null>(null);

function loadCurrency(): Currency {
  const stored = localStorage.getItem(CURRENCY_KEY);
  return stored === "USD" || stored === "ARS" ? stored : "USD";
}

function loadExchangeRate(): ExchangeRate {
  try {
    const raw = localStorage.getItem(EXCHANGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExchangeRate;
      if (parsed.rate && parsed.rate > 0) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_RATE;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, _setCurrency]         = useState<Currency>(loadCurrency);
  const [exchangeRate, _setExchangeRate] = useState<ExchangeRate>(loadExchangeRate);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [fetchRateError, setFetchRateError] = useState<string | null>(null);

  const setCurrency = useCallback((c: Currency) => {
    _setCurrency(c);
    localStorage.setItem(CURRENCY_KEY, c);
  }, []);

  const setExchangeRate = useCallback((r: ExchangeRate) => {
    _setExchangeRate(r);
    localStorage.setItem(EXCHANGE_KEY, JSON.stringify(r));
  }, []);

  const convertPrice = useCallback((usdValue: number): number => {
    return currency === "ARS" ? usdValue * exchangeRate.rate : usdValue;
  }, [currency, exchangeRate.rate]);

  const formatPrice = useCallback((usdValue: number): string => {
    return currency === "ARS"
      ? fmtARS(usdValue, exchangeRate.rate)
      : fmtUSD(usdValue);
  }, [currency, exchangeRate.rate]);

  const formatUSD = useCallback((usdValue: number) => fmtUSD(usdValue), []);
  const formatARS = useCallback((usdValue: number) => fmtARS(usdValue, exchangeRate.rate), [exchangeRate.rate]);

  /**
   * Fetches the current USD blue rate from dolarapi.com.
   * Endpoint: GET https://dolarapi.com/v1/dolares/blue
   * Response: { compra, venta, casa, nombre, moneda, fechaActualizacion }
   * Using `venta` (sell price) as the reference rate for pricing.
   *
   * To switch rate type change the endpoint:
   *   /dolares/oficial    → official/bank rate
   *   /dolares/blue       → parallel/informal market
   *   /dolares/mayorista  → wholesale rate
   *   /dolares/tarjeta    → credit card rate
   */
  const fetchExchangeRate = useCallback(async () => {
    setIsFetchingRate(true);
    setFetchRateError(null);
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares/oficial");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { venta?: number; fechaActualizacion?: string };
      const rate = json.venta;
      if (!rate || rate <= 0) throw new Error("Valor inválido en respuesta");
      setExchangeRate({
        rate,
        source: "api",
        updatedAt: json.fechaActualizacion ?? new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setFetchRateError(msg);
      throw err;
    } finally {
      setIsFetchingRate(false);
    }
  }, [setExchangeRate]);

  // Auto-fetch on mount if cached rate is stale (> TTL) or was manually entered
  useEffect(() => {
    const cachedAt = new Date(exchangeRate.updatedAt).getTime();
    const isStale = Date.now() - cachedAt > RATE_TTL_MS;
    if (isStale || exchangeRate.source === "manual") {
      fetchExchangeRate().catch(() => { /* silently fall back to cached rate */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<CurrencyContextType>(() => ({
    currency, setCurrency,
    exchangeRate, setExchangeRate,
    convertPrice, formatPrice, formatUSD, formatARS,
    fetchExchangeRate, isFetchingRate, fetchRateError,
  }), [currency, setCurrency, exchangeRate, setExchangeRate,
       convertPrice, formatPrice, formatUSD, formatARS,
       fetchExchangeRate, isFetchingRate, fetchRateError]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
