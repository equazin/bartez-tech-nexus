import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { MonthlyTrendRow } from "@/hooks/useClientReports";

const config: ChartConfig = {
  revenue: { label: "Compras", color: "hsl(var(--brand-500))" },
};

interface Props {
  data: MonthlyTrendRow[];
  loading: boolean;
}

function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

export function MonthlyTrend({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-52 w-full rounded-xl" />;
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;

  const chartData = data.map((r) => ({
    month:   formatMonth(r.month),
    revenue: r.revenue,
    orders:  r.order_count,
  }));

  return (
    <ChartContainer config={config} className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTooltipContent />} />
          <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
