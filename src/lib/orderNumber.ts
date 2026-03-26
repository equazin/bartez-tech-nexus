const COUNTER_KEY = "b2b_order_counter";

/**
 * Genera el próximo número correlativo de pedido: ORD-0001, ORD-0002, ...
 * El contador persiste en localStorage y nunca retrocede.
 */
export function nextOrderNumber(): string {
  const current = parseInt(localStorage.getItem(COUNTER_KEY) ?? "0", 10);
  const next = isNaN(current) ? 1 : current + 1;
  localStorage.setItem(COUNTER_KEY, String(next));
  return `ORD-${String(next).padStart(4, "0")}`;
}

/** Lee el último número generado sin incrementar */
export function peekLastOrderNumber(): string | null {
  const v = localStorage.getItem(COUNTER_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : `ORD-${String(n).padStart(4, "0")}`;
}
