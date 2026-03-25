import { Supplier } from "@/models/supplier";

const SUPPLIER_KEY = "b2b_suppliers";

export function getStoredSuppliers(): Supplier[] {
  const raw = localStorage.getItem(SUPPLIER_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSuppliers(suppliers: Supplier[]) {
  localStorage.setItem(SUPPLIER_KEY, JSON.stringify(suppliers));
}

export function addSupplier(supplier: Supplier) {
  const suppliers = getStoredSuppliers();
  suppliers.push(supplier);
  saveSuppliers(suppliers);
}

export function findSupplierByName(name: string): Supplier | undefined {
  return getStoredSuppliers().find(s => s.name.toLowerCase() === name.toLowerCase());
}
