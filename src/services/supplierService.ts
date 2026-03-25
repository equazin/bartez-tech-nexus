import { Product } from "@/models/product";
import { Supplier } from "@/models/supplier";

// Local mock data for now
let suppliers: Supplier[] = [];
let products: Product[] = [];

export async function getProducts(): Promise<Product[]> {
  return Promise.resolve(products);
}

export function updateStock(productId: number, newStock: number): void {
  const product = products.find(p => p.id === productId);
  if (product) product.stock = newStock;
}

export function updatePrices(supplierId: number, newMultiplier: number): void {
  suppliers = suppliers.map(s =>
    s.id === supplierId ? { ...s, price_multiplier: newMultiplier } : s
  );
  products = products.map(p =>
    p.supplier_id === supplierId
      ? { ...p, cost_price: p.cost_price * newMultiplier }
      : p
  );
}

export function getSuppliers(): Supplier[] {
  return suppliers;
}

export function addSupplier(supplier: Supplier): void {
  suppliers.push(supplier);
}

export function setProducts(newProducts: Product[]): void {
  products = newProducts;
}

export function setSuppliers(newSuppliers: Supplier[]): void {
  suppliers = newSuppliers;
}
