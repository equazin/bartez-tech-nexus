import { useState, useEffect, useCallback } from "react";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/api/suppliers";
import type { Supplier, SupplierInsert, SupplierUpdate } from "@/models/supplier";

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await fetchSuppliers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(input: SupplierInsert): Promise<Supplier> {
    const created = await createSupplier(input);
    setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }

  async function edit(id: string, input: SupplierUpdate): Promise<void> {
    const updated = await updateSupplier(id, input);
    setSuppliers((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  async function remove(id: string): Promise<void> {
    await deleteSupplier(id);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  return { suppliers, loading, error, refresh: load, add, edit, remove };
}
