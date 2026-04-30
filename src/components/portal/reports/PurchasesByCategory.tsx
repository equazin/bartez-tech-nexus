import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { CategoryStat } from "@/hooks/useClientReports";

const COLORS = [
  "hsl(var(--brand-500))",
  "hsl(var(--brand-300))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--danger))",
];

interface Props {
  data: CategoryStat[];
  loading: boolean;
}

export function PurchasesByCategory({ data, loading }: Props) {
  if (loading) return <Skeleton className="h-52 w-full rounded-xl" />;
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;

  const total = data.reduce((s, r) => s + r.revenue, 0);
  const chartData = data.map((r) => ({
    name:    r.category,
    value:   r.revenue,
    pct:     total > 0 ? ((r.revenue / total) * 100).toFixed(1) : "0",
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) =>
            [`$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`, "Compras"]
          }
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value, entry: any) => `${value} (${entry.payload.pct}%)`}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
