import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { CategoryNode } from "@/components/portal/catalog/types";

type DbCat = { id: number; name: string; parent_id: number | null; slug: string | null };

function buildTree(rows: DbCat[], counts: Map<number, number>): CategoryNode[] {
  const nodeMap = new Map<number, CategoryNode>();

  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parent_id,
      count: counts.get(row.id) ?? 0,
      ownCount: 0,
      children: [],
    });
  }

  const roots: CategoryNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId !== null && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function useCategoryTree(counts: Map<number, number>) {
  const [roots, setRoots] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, parent_id, slug")
        .eq("active", true)
        .order("name");

      if (cancelled) return;
      if (error || !data) { setLoading(false); return; }

      setRoots(buildTree(data as DbCat[], counts));
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  // Re-build tree when counts change (RPC response arrives)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts]);

  return { roots, loading };
}
