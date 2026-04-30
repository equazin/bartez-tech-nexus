import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { StockCell } from "@/components/ui/stock-cell";
import { Skeleton } from "@/components/ui/skeleton";

interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  location: string | null;
  stock: number;
  stock_reserved: number;
}

interface Props {
  productId: number;
}

export function StockByWarehouse({ productId }: Props) {
  const [rows, setRows] = useState<WarehouseStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    supabase
      .from("product_stocks")
      .select("warehouse_id, stock, stock_reserved, warehouses(name, location)")
      .eq("product_id", productId)
      .gt("stock", 0)
      .then(({ data }) => {
        if (cancelled) return;
        const mapped: WarehouseStock[] = (data ?? []).map((r: any) => ({
          warehouse_id: r.warehouse_id,
          warehouse_name: r.warehouses?.name ?? "Depósito",
          location: r.warehouses?.location ?? null,
          stock: r.stock ?? 0,
          stock_reserved: r.stock_reserved ?? 0,
        }));
        setRows(mapped);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [productId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 text-sm font-semibold">Stock por depósito</p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.warehouse_id} className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">{r.warehouse_name}</span>
              {r.location && (
                <span className="ml-1.5 text-xs text-muted-foreground">{r.location}</span>
              )}
            </div>
            <StockCell
              available={Math.max(0, r.stock - r.stock_reserved)}
              reserved={r.stock_reserved}
              density="compact"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
