import type { Currency } from "@/context/CurrencyContext";
import type { Invoice } from "@/lib/api/invoices";

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function convertMoneyAmount(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  exchangeRate: number
): number {
  if (!Number.isFinite(amount)) return 0;
  if (fromCurrency === toCurrency) return amount;
  if (!exchangeRate || exchangeRate <= 0) return amount;
  return fromCurrency === "USD"
    ? amount * exchangeRate
    : amount / exchangeRate;
}

export function formatMoneyAmount(
  amount: number,
  currency: Currency,
  maximumFractionDigits = 0
): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

export function formatMoneyInPreferredCurrency(
  amount: number,
  sourceCurrency: Currency,
  preferredCurrency: Currency,
  exchangeRate: number,
  maximumFractionDigits = 0
): string {
  const converted = convertMoneyAmount(amount, sourceCurrency, preferredCurrency, exchangeRate);
  return formatMoneyAmount(converted, preferredCurrency, maximumFractionDigits);
}

export type EffectiveInvoiceAmounts = {
  subtotal: number;
  ivaTotal: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  isLegacyPreview: boolean;
  hasInferredIva: boolean;
};

export function getEffectiveInvoiceAmounts(
  invoice: Invoice,
  fallbackExchangeRate: number
): EffectiveInvoiceAmounts {
  const inferredIva = invoice.iva_total > 0
    ? invoice.iva_total
    : Math.max(0, Number(invoice.total ?? 0) - Number(invoice.subtotal ?? 0));
  const normalizedTotal = Number(invoice.total ?? 0) || Number(invoice.subtotal ?? 0) + inferredIva;
  const hasInferredIva = invoice.iva_total <= 0 && inferredIva > 0;
  const needsLegacyRepairPreview = invoice.currency === "ARS" && (!invoice.exchange_rate || invoice.exchange_rate <= 0);

  if (needsLegacyRepairPreview) {
    return {
      subtotal: roundMoney(Number(invoice.subtotal ?? 0) * fallbackExchangeRate),
      ivaTotal: roundMoney(inferredIva * fallbackExchangeRate),
      total: roundMoney(normalizedTotal * fallbackExchangeRate),
      currency: "ARS",
      exchangeRate: fallbackExchangeRate,
      isLegacyPreview: true,
      hasInferredIva,
    };
  }

  return {
    subtotal: Number(invoice.subtotal ?? 0),
    ivaTotal: inferredIva,
    total: normalizedTotal,
    currency: invoice.currency,
    exchangeRate: invoice.exchange_rate ?? undefined,
    isLegacyPreview: false,
    hasInferredIva,
  };
}
