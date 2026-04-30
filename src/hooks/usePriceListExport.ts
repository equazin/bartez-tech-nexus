import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { PriceListRow } from "@/components/portal/catalog/types";

function rowsToCsv(rows: PriceListRow[]): string {
  const header = ["SKU", "Nombre", "Marca", "Categoría", "Precio", "Stock", "Cant. mínima"].join(",");
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = rows.map((r) =>
    [r.sku, r.name, r.brand_name, r.category, r.unit_price, r.stock, r.min_order_qty]
      .map(escape)
      .join(",")
  );
  return [header, ...lines].join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchRows(clientId: string): Promise<PriceListRow[]> {
  const { data, error } = await supabase.rpc("get_price_list_for_client", {
    p_client_id: clientId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PriceListRow[];
}

export function usePriceListExport(clientId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCsv = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchRows(clientId);
      const csv = rowsToCsv(rows);
      triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "lista_precios.csv");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const exportXlsx = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchRows(clientId);
      // Lazy-load xlsx to keep main bundle small
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(
        rows.map((r) => ({
          SKU: r.sku,
          Nombre: r.name,
          Marca: r.brand_name,
          Categoría: r.category,
          Precio: r.unit_price,
          Stock: r.stock,
          "Cant. mínima": r.min_order_qty,
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lista de precios");
      XLSX.writeFile(wb, "lista_precios.xlsx");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  return { exportCsv, exportXlsx, loading, error };
}
