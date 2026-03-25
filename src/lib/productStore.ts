import { Product } from "./products";

const STORAGE_KEY = "b2b_products";

export function getStoredProducts(): Product[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProducts(products: Product[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function addProduct(product: Product) {
  const products = getStoredProducts();
  products.push(product);
  saveProducts(products);
}

export function mergeProducts(newProducts: Product[]): { imported: number; errors: string[] } {
  const existing = getStoredProducts();
  const names = new Set(existing.map((p) => p.name.toLowerCase()));
  let imported = 0;
  const errors: string[] = [];
  for (const prod of newProducts) {
    if (!prod.name || typeof prod.cost_price !== "number" || isNaN(prod.cost_price)) {
      errors.push(`Invalid product: ${prod.name || "(no name)"}`);
      continue;
    }
    if (names.has(prod.name.toLowerCase())) {
      errors.push(`Duplicate: ${prod.name}`);
      continue;
    }
    existing.push(prod);
    names.add(prod.name.toLowerCase());
    imported++;
  }
  saveProducts(existing);
  return { imported, errors };
}
