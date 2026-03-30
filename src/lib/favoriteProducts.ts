const FAVORITES_KEY = "b2b_favorite_products";

type FavoritesMap = Record<string, number[]>;

function readFavorites(): FavoritesMap {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FavoritesMap;
  } catch {
    return {};
  }
}

function writeFavorites(value: FavoritesMap) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(value));
}

export function getFavoriteProducts(userId: string): number[] {
  return readFavorites()[userId] ?? [];
}

export function toggleFavoriteProduct(userId: string, productId: number): number[] {
  const map = readFavorites();
  const current = new Set(map[userId] ?? []);
  if (current.has(productId)) {
    current.delete(productId);
  } else {
    current.add(productId);
  }
  const next = [...current];
  map[userId] = next;
  writeFavorites(map);
  return next;
}
