import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "./types";

interface Props {
  node: CategoryNode;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  depth?: number;
}

const INDENT_PER_DEPTH = 12; // px

export function CategoryTreeNode({ node, selectedId, onSelect, depth = 0 }: Props) {
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  const isAncestorOfSelected = (n: CategoryNode): boolean => {
    if (n.id === selectedId) return true;
    return n.children.some(isAncestorOfSelected);
  };

  const [expanded, setExpanded] = useState(() => isAncestorOfSelected(node));
  const showCount = typeof node.count === "number";

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(isSelected ? null : node.id);
          if (hasChildren && !expanded) setExpanded(true);
        }}
        className={cn(
          "group flex w-full items-center gap-1.5 rounded-md py-1.5 pr-3 text-sm transition-colors",
          "hover:bg-surface-2 text-left",
          isSelected && "bg-brand-100 text-brand-700 font-medium dark:bg-brand-900/40 dark:text-brand-300",
          !isSelected && "text-foreground/80",
        )}
        style={{ paddingLeft: 8 + depth * INDENT_PER_DEPTH }}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="shrink-0 rounded p-0.5 hover:bg-muted"
            aria-label={expanded ? "Contraer" : "Expandir"}
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
            />
          </span>
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {showCount && (
          <Badge
            variant="secondary"
            className={cn(
              "ml-2 min-w-10 shrink-0 justify-center tabular-nums",
              node.count === 0 && "opacity-50",
            )}
          >
            {node.count}
          </Badge>
        )}
      </button>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
