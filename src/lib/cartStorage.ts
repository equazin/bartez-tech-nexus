export type CartQuantities = Record<number, number>;

export interface BundleCartMeta {
  bundleId: string;
  bundleName: string;
}

export type BundleCartMetaMap = Record<number, BundleCartMeta>;

export function getCartStorageKeys(userId: string) {
  return {
    cartKey: `b2b_cart_${userId || "guest"}`,
    metaKey: `b2b_cart_meta_${userId || "guest"}`,
  };
}

function readJsonRecord<T extends Record<number, unknown>>(key: string): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {} as T;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export function readStoredCart(userId: string): CartQuantities {
  return readJsonRecord<CartQuantities>(getCartStorageKeys(userId).cartKey);
}

export function writeStoredCart(userId: string, cart: CartQuantities) {
  localStorage.setItem(getCartStorageKeys(userId).cartKey, JSON.stringify(cart));
}

export function readStoredBundleCartMeta(userId: string): BundleCartMetaMap {
  return readJsonRecord<BundleCartMetaMap>(getCartStorageKeys(userId).metaKey);
}

export function writeStoredBundleCartMeta(userId: string, meta: BundleCartMetaMap) {
  localStorage.setItem(getCartStorageKeys(userId).metaKey, JSON.stringify(meta));
}

export function hasCartItems(cart: CartQuantities) {
  return Object.values(cart).some((qty) => Number(qty) > 0);
}
