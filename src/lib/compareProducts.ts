const STORAGE_PREFIX = "bartez_compare_";
const MAX_COMPARE = 4;

function key(clientId: string): string {
  return `${STORAGE_PREFIX}${clientId || "guest"}`;
}

export function getCompareProducts(clientId: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(clientId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === "number" && Number.isFinite(v)).slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
}

export function isInCompare(clientId: string, productId: number): boolean {
  return getCompareProducts(clientId).includes(productId);
}

export function toggleCompareProduct(clientId: string, productId: number): number[] {
  const current = getCompareProducts(clientId);
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : current.length >= MAX_COMPARE
      ? current
      : [...current, productId];
  try {
    window.localStorage.setItem(key(clientId), JSON.stringify(next));
  } catch {
    // quota — ignore
  }
  return next;
}

export function clearCompareProducts(clientId: string): void {
  try {
    window.localStorage.removeItem(key(clientId));
  } catch {
    // ignore
  }
}

export const MAX_COMPARE_PRODUCTS = MAX_COMPARE;
