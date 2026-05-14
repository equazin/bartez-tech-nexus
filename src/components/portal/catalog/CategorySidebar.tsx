import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryTreeNode } from "./CategoryTreeNode";
import type { CategoryNode } from "./types";

interface Props {
  roots: CategoryNode[];
  loading: boolean;
  selectedId: number | null;
  totalCount: number;
  onSelect: (id: number | null) => void;
}

export function CategorySidebar({ roots, loading, selectedId, totalCount, onSelect }: Props) {
  return (
    <aside className="flex h-full flex-col border-r bg-background">
      <div className="shrink-0 border-b px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categorías
        </span>
      </div>

      <ScrollArea className="flex-1 px-2.5 py-2">
        {/* "Todas" reset button */}
        <Button
          variant={selectedId === null ? "secondary" : "ghost"}
          size="sm"
          className="mb-1 w-full justify-between gap-3 px-3 font-normal"
          onClick={() => onSelect(null)}
        >
          <span className="min-w-0 truncate">Todas</span>
          <Badge variant="secondary" className="min-w-10 shrink-0 justify-center tabular-nums">{totalCount}</Badge>
        </Button>

        {loading && roots.length === 0
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="mb-1 h-7 w-full rounded-md" />
            ))
          : roots.map((node) => (
              <CategoryTreeNode
                key={node.id}
                node={node}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
      </ScrollArea>
    </aside>
  );
}
