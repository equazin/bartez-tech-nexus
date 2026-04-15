import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { supabase } from "@/lib/supabase";

interface PriceHistoryPoint {
  date: string;
  label: string;
  unitPrice: number;
  quantity: number;
}

interface OrderHistoryRow {
  created_at: string;
  status: string;
  order_items?: Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
  }> | null;
}

export interface PriceHistoryChartProps {
  productId: number;
  profileId: string;
  currentPrice: number;
  formatPrice: (value: number) => string;
}

const chartConfig = {
  unitPrice: {
    label: "Precio pagado",
    color: "hsl(var(--primary))",
  },
} as const;

function formatPointLabel(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function PriceHistoryChart({
  productId,
  profileId,
  currentPrice,
  formatPrice,
}: PriceHistoryChartProps) {
  const [points, setPoints] = useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadHistory() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(`
            created_at,
            status,
            order_items (
              product_id,
              quantity,
              unit_price
            )
          `)
          .eq("client_id", profileId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;

        const history = ((data ?? []) as OrderHistoryRow[])
          .filter((order) => !["rejected", "pending_approval"].includes(order.status))
          .flatMap((order) =>
            (order.order_items ?? [])
              .filter((item) => Number(item.product_id) === productId)
              .map((item) => ({
                date: order.created_at,
                label: formatPointLabel(order.created_at),
                unitPrice: Number(item.unit_price ?? 0),
                quantity: Number(item.quantity ?? 0),
              })),
          )
          .slice(0, 10)
          .reverse();

        if (alive) setPoints(history);
      } catch {
        if (alive) setPoints([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadHistory();

    return () => {
      alive = false;
    };
  }, [productId, profileId]);

  const latest = useMemo(() => points[points.length - 1] ?? null, [points]);

  if (loading) {
    return <div className="h-44 animate-pulse rounded-2xl border border-border/70 bg-surface/60" />;
  }

  if (points.length === 0) {
    return (
      <EmptyState
        className="rounded-[22px]"
        title="Sin historial de compra"
        description="Todavia no hay compras registradas de este SKU para tu cuenta."
      />
    );
  }

  return (
    <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Mi historial
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">Ultimas 10 compras del producto</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Precio actual: <span className="font-semibold text-foreground">{formatPrice(currentPrice)}</span>
          </p>
        </div>

        {latest ? (
          <div className="rounded-2xl border border-border/70 bg-surface/60 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ultima compra</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatPrice(latest.unitPrice)}</p>
            <p className="text-xs text-muted-foreground">
              {latest.quantity} u. el {new Date(latest.date).toLocaleDateString("es-AR")}
            </p>
          </div>
        ) : null}
      </div>

      <ChartContainer config={chartConfig} className="h-52 w-full">
        <LineChart data={points} margin={{ left: 12, right: 12, top: 12, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatPrice(Number(value))}
            width={96}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {name === "unitPrice" ? "Precio pagado" : String(name)}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {formatPrice(Number(value))}
                    </span>
                    {"payload" in item && item.payload ? (
                      <span className="text-muted-foreground">{item.payload.quantity} u.</span>
                    ) : null}
                  </div>
                )}
              />
            }
          />
          <ReferenceLine
            y={currentPrice}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
          <Line
            type="monotone"
            dataKey="unitPrice"
            stroke="var(--color-unitPrice)"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>

      <div className="overflow-hidden rounded-2xl border border-border/70">
        <div className="grid grid-cols-[110px_1fr_80px] gap-2 bg-surface/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span>Fecha</span>
          <span>Precio unitario</span>
          <span className="text-right">Cantidad</span>
        </div>
        {points
          .slice()
          .reverse()
          .map((point) => (
            <div
              key={`${point.date}-${point.quantity}-${point.unitPrice}`}
              className="grid grid-cols-[110px_1fr_80px] gap-2 border-t border-border/70 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">
                {new Date(point.date).toLocaleDateString("es-AR")}
              </span>
              <span className="font-medium text-foreground">{formatPrice(point.unitPrice)}</span>
              <span className="text-right text-foreground">{point.quantity} u.</span>
            </div>
          ))}
      </div>
    </SurfaceCard>
  );
}
