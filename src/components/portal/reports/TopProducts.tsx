import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyCell } from "@/components/ui/money-cell";
import type { TopProduct } from "@/hooks/useClientReports";

interface Props {
  data: TopProduct[];
  loading: boolean;
}

export function TopProducts({ data, loading }: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
      </div>
    );
  }
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;

  const max = data[0]?.revenue ?? 1;

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((p, i) => (
        <button
          key={p.product_id}
          type="button"
          onClick={() => navigate(`/portal/p/${p.sku ?? p.product_id}`)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        >
          <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${(p.revenue / max) * 100}%` }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <MoneyCell value={p.revenue} emphasis="muted" className="text-xs" />
            <p className="text-xs text-muted-foreground">{p.units_sold} u.</p>
          </div>
        </button>
      ))}
    </div>
  );
}
