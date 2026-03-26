export interface SavedCart {
  id: string;
  name: string;
  items: Record<number, number>;
  margins: Record<number, number>;
  savedAt: string;
}

function key(userId: string) {
  return `b2b_saved_carts_${userId}`;
}

export function getSavedCarts(userId: string): SavedCart[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) || "[]");
  } catch {
    return [];
  }
}

export function saveCart(
  userId: string,
  name: string,
  items: Record<number, number>,
  margins: Record<number, number>
): SavedCart {
  const cart: SavedCart = {
    id: `sc_${Date.now()}`,
    name: name.trim() || `Carrito ${new Date().toLocaleDateString("es-AR")}`,
    items,
    margins,
    savedAt: new Date().toISOString(),
  };
  const all = getSavedCarts(userId);
  all.unshift(cart);
  localStorage.setItem(key(userId), JSON.stringify(all.slice(0, 10))); // máx 10
  return cart;
}

export function deleteSavedCart(userId: string, cartId: string): void {
  const all = getSavedCarts(userId).filter((c) => c.id !== cartId);
  localStorage.setItem(key(userId), JSON.stringify(all));
}
