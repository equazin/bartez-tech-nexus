import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PricePoint {
  created_at: string;
  new_price: number;
}

interface Props {
  productId: number;
  currentPrice: number;
  isDark?: boolean;
}

/**
 * Fetches price_history for a product and renders a compact SVG sparkline
 * with min/max/current annotations and trend indicator.
 */
export function PriceSparkline({ productId, currentPrice, isDark = true }: Props) {
  const [points, setPoints]   = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 90);

    supabase
      .from("price_history")
      .select("created_at, new_price")
      .eq("product_id", productId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true })
      .limit(60)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPoints(data as PricePoint[]);
        }
        setLoading(false);
      });
  }, [productId]);

  if (loading) {
    return (
      <div className="h-10 rounded-md animate-pulse bg-[#1c1c1c] w-full" />
    );
  }

  // Build full data series: history + current price as last point
  const series: PricePoint[] = [
    ...points,
    { created_at: new Date().toISOString(), new_price: currentPrice },
  ];

  if (series.length < 2) {
    return (
      <p className="text-[10px] text-[#525252] italic">Sin historial de precios (últimos 90 días)</p>
    );
  }

  const prices = series.map((p) => p.new_price);
  const minP   = Math.min(...prices);
  const maxP   = Math.max(...prices);
  const range  = maxP - minP || 1;

  const W = 200;
  const H = 40;
  const pad = 4;

  const toX = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2);
  const toY = (v: number) => H - pad - ((v - minP) / range) * (H - pad * 2);

  const pathD = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.new_price).toFixed(1)}`)
    .join(" ");

  // Trend: compare first and last price
  const first = prices[0];
  const last  = prices[prices.length - 1];
  const changePct = ((last - first) / first) * 100;
  const isUp   = changePct > 0.5;
  const isDown = changePct < -0.5;
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendColor = isUp ? "#f87171" : isDown ? "#4ade80" : "#737373";
  // Up = bad (price rose, more expensive), Down = good (cheaper)
  const lineColor = isDark ? (isDown ? "#2D9F6A" : isUp ? "#f87171" : "#525252") : "#2D9F6A";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#525252] uppercase tracking-wider">Precio últimos 90 días</span>
        <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: trendColor }}>
          <TrendIcon size={10} />
          {changePct > 0 ? "+" : ""}{changePct.toFixed(1)}%
        </span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Area fill */}
        <path
          d={`${pathD} L${toX(series.length - 1).toFixed(1)},${H} L${toX(0).toFixed(1)},${H} Z`}
          fill={lineColor}
          fillOpacity={0.08}
        />
        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Current price dot */}
        <circle
          cx={toX(series.length - 1)}
          cy={toY(last)}
          r={3}
          fill={lineColor}
        />
      </svg>

      <div className="flex justify-between text-[9px] font-mono tabular-nums" style={{ color: "#525252" }}>
        <span>min ${minP.toFixed(0)}</span>
        <span>{series.length - 1} cambio{series.length - 1 !== 1 ? "s" : ""}</span>
        <span>max ${maxP.toFixed(0)}</span>
      </div>
    </div>
  );
}
