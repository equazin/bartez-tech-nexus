import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface ProductSupplier {
  id: string;
  product_id: number;
  supplier_id: string;
  supplier_name?: string;       // joined from suppliers
  cost_price: number;
  source_cost_price?: number;
  source_currency?: "USD" | "ARS";
  source_exchange_rate?: number;
  stock_available: number;
  stock_reserved: number;
  price_multiplier: number;
  lead_time_days: number;
  is_preferred: boolean;
  active: boolean;
  external_id?: string;
  last_synced_at?: string;
}

export interface StockSummary {
  product_id: number;
  total_available: number;
  total_reserved: number;
  net_available: number;
  best_cost: number;
  min_lead_time: number;
  supplier_count: number;
}

interface ProductSupplierQueryRow extends ProductSupplier {
  suppliers?: { name?: string | null } | null;
}

/**
 * Manages the product_suppliers table:
 * - Fetch all supplier sources for a product
 * - Get aggregate stock summary
 * - Update per-supplier stock/price
 * - Set preferred supplier
 */
export function useProductSuppliers(productId: number | null) {
  const [suppliers, setSuppliers] = useState<ProductSupplier[]>([]);
  const [summary, setSummary]     = useState<StockSummary | null>(null);
  const [loading, setLoading]     = useState(false);

  const fetchSuppliers = useCallback(async () => {
    if (!productId) return;
    setLoading(true);

    const [{ data: psData }, { data: sumData }] = await Promise.all([
      supabase
        .from("product_suppliers")
        .select("*, suppliers(name)")
        .eq("product_id", productId)
        .order("is_preferred", { ascending: false })
        .order("cost_price", { ascending: true }),
      supabase
        .from("product_stock_summary")
        .select("*")
        .eq("product_id", productId)
        .single(),
    ]);

    setSuppliers(
      ((psData ?? []) as ProductSupplierQueryRow[]).map((row) => ({
        ...row,
        supplier_name: row.suppliers?.name ?? undefined,
      }))
    );
    setSummary((sumData as StockSummary) ?? null);
    setLoading(false);
  }, [productId]);

  async function setPreferred(supplierRecordId: string) {
    if (!productId) return;
    // Clear all preferred, then set the chosen one
    await supabase
      .from("product_suppliers")
      .update({ is_preferred: false })
      .eq("product_id", productId);
    await supabase
      .from("product_suppliers")
      .update({ is_preferred: true })
      .eq("id", supplierRecordId);
    fetchSuppliers();
  }

  async function updateStockPrice(
    supplierRecordId: string,
    updates: Partial<Pick<ProductSupplier, "cost_price" | "stock_available" | "price_multiplier" | "lead_time_days">>
  ) {
    const { error } = await supabase
      .from("product_suppliers")
      .update(updates)
      .eq("id", supplierRecordId);
    if (!error) fetchSuppliers();
    return error;
  }

  async function addSupplierSource(
    supplierId: string,
    data: { cost_price: number; stock_available: number; price_multiplier?: number; lead_time_days?: number }
  ) {
    if (!productId) return;
    const { error } = await supabase.from("product_suppliers").insert({
      product_id:       productId,
      supplier_id:      supplierId,
      cost_price:       data.cost_price,
      stock_available:  data.stock_available,
      price_multiplier: data.price_multiplier ?? 1.0,
      lead_time_days:   data.lead_time_days ?? 0,
    });
    if (!error) fetchSuppliers();
    return error;
  }

  async function removeSupplierSource(supplierRecordId: string) {
    await supabase.from("product_suppliers").delete().eq("id", supplierRecordId);
    fetchSuppliers();
  }

  /** Get best supplier: preferred → cheapest → most stock */
  const bestSupplier = suppliers.find((s) => s.is_preferred && s.active && s.stock_available > s.stock_reserved)
    ?? suppliers.find((s) => s.active && (s.stock_available - s.stock_reserved) > 0);

  return {
    suppliers,
    summary,
    loading,
    bestSupplier,
    fetchSuppliers,
    setPreferred,
    updateStockPrice,
    addSupplierSource,
    removeSupplierSource,
  };
}
