/**
 * usePortalCatalog — Manages catalog state for the B2B portal.
 * Encapsulates: category tree, brand/category counts, filters, display product sorting.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useProducts } from "@/hooks/useProducts";
import { useBrands } from "@/hooks/useBrands";
import { getAvailableStock } from "@/lib/pricing";
import type { Product } from "@/models/products";
import type { CatalogContext } from "@/components/b2b/CatalogSection";

// ── Internal helpers ─────────────────────────────────────────────────────────

function normalizePortalText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasWord(value: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(value);
}

function isPosCategoryValue(value: unknown): boolean {
  const norm = normalizePortalText(value);
  return norm.includes("punto de venta") || hasWord(norm, "pos");
}

function getProductFeaturedPriority(product: Product): number {
  const raw = product.specs?.featured_priority;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

type DbCat = { id: number; name: string; parent_id: number | null; slug?: string | null };

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePortalCatalogOptions {
  catalogContext: CatalogContext;
  isAdmin?: boolean;
  hiddenProductIds?: Set<number>;
}

export function usePortalCatalog({
  catalogContext,
  isAdmin = false,
  hiddenProductIds = new Set(),
}: UsePortalCatalogOptions) {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // ── DB categories ─────────────────────────────────────────────────────────
  const [dbCats, setDbCats] = useState<DbCat[]>([]);
  const [serverCategoryCounts, setServerCategoryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setDbCats(data as DbCat[]);
    });

    supabase.from("products").select("category").eq("active", true).then(({ data }) => {
      if (data && Array.isArray(data)) {
        const counts: Record<string, number> = {};
        data.forEach((p: { category?: string }) => {
          if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
        });
        setServerCategoryCounts(counts);
      }
    });
  }, []);

  // ── Category tree ─────────────────────────────────────────────────────────
  const categoryTree = useMemo(() => {
    const byId = new Map(dbCats.map((cat) => [cat.id, cat]));
    const byName = new Map(dbCats.map((cat) => [cat.name, cat]));
    const rootNodes = dbCats
      .filter((cat) => cat.parent_id === null)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    const childrenByRoot = new Map<string, Set<string>>();
    rootNodes.forEach((root) => childrenByRoot.set(root.name, new Set()));

    const standalone = new Set<string>();

    Object.keys(serverCategoryCounts).forEach((categoryName) => {
      const dbMatch = byName.get(categoryName);
      if (!dbMatch) { standalone.add(categoryName); return; }

      let current: DbCat | undefined = dbMatch;
      let guard = 0;
      while (current && current.parent_id !== null && guard < 20) {
        current = byId.get(current.parent_id);
        guard += 1;
      }
      const rootName = current?.name ?? null;
      if (!rootName) { standalone.add(categoryName); return; }
      if (dbMatch.name !== rootName) childrenByRoot.get(rootName)?.add(dbMatch.name);
    });

    const parents = rootNodes
      .map((root) => {
        const children = Array.from(childrenByRoot.get(root.name) ?? []).sort((a, b) => a.localeCompare(b, "es"));
        const parentHasProducts = serverCategoryCounts[root.name] > 0;
        if (!parentHasProducts && children.length === 0) return null;
        return { name: root.name, children };
      })
      .filter((item): item is { name: string; children: string[] } => item !== null);

    return { parents, leaves: Array.from(standalone).sort((a, b) => a.localeCompare(b, "es")) };
  }, [dbCats, serverCategoryCounts]);

  const parentChildrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    categoryTree.parents.forEach(({ name, children }) => {
      map[name] = [name, ...children];
    });
    return map;
  }, [categoryTree]);

  // ── POS categories ────────────────────────────────────────────────────────
  const posCategoryNames = useMemo(() => {
    if (dbCats.length === 0) return new Set<string>();
    const byId = new Map(dbCats.map((cat) => [cat.id, cat]));
    const posRoots = dbCats.filter((cat) => {
      const nameNorm = normalizePortalText(cat.name);
      const slugNorm = normalizePortalText(cat.slug);
      return slugNorm === "pos" || nameNorm.includes("punto de venta") || hasWord(nameNorm, "pos");
    });

    const out = new Set<string>();
    for (const root of posRoots) {
      const stack = [root.id];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const current = byId.get(currentId);
        if (!current) continue;
        out.add(normalizePortalText(current.name));
        for (const child of dbCats) {
          if (child.parent_id === currentId) stack.push(child.id);
        }
      }
    }
    return out;
  }, [dbCats]);

  const isPosProduct = useCallback((product: Product) => {
    const norm = normalizePortalText(product.category);
    if (!norm) return false;
    if (posCategoryNames.size > 0) return posCategoryNames.has(norm);
    return isPosCategoryValue(product.category);
  }, [posCategoryNames]);

  // ── Products fetch ────────────────────────────────────────────────────────
  const {
    products,
    totalCount,
    loading: productsLoading,
    hasMore,
    loadMore,
    error: productsError,
  } = useProducts({
    category: categoryFilter !== "all" ? (parentChildrenMap[categoryFilter] || categoryFilter) : "all",
    brand: brandFilter,
    search: "", // search is managed outside and passed as prop in portal header
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    pageSize: 40,
    isAdmin,
    isFeatured: catalogContext === "featured",
    sortBy: catalogContext === "featured" ? "featured" : "name",
  });

  const { brands } = useBrands();

  // ── Counts ────────────────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: totalCount };

    if (Object.keys(serverCategoryCounts).length > 0) {
      Object.entries(serverCategoryCounts).forEach(([cat, count]) => { counts[cat] = count; });
      categoryTree.parents.forEach(({ name, children }) => {
        const childrenTotal = children.reduce((sum, child) => sum + (serverCategoryCounts[child] || 0), 0);
        counts[name] = (serverCategoryCounts[name] || 0) + childrenTotal;
      });
    } else {
      products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    }

    return counts;
  }, [totalCount, serverCategoryCounts, categoryTree, products]);

  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      if (p.brand_id) counts[p.brand_id] = (counts[p.brand_id] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  const activeBrandsWithProducts = useMemo(
    () => brands.filter((b) => (brandCounts[b.id] ?? 0) > 0),
    [brands, brandCounts]
  );

  // ── Display products (sorted, filtered by context + segment) ─────────────
  const displayProducts = useCallback(
    (purchaseHistory: Record<number, number>, productMargins: Record<number, number>, globalMargin: number): Product[] => {
      const contextBase = catalogContext === "pos"
        ? products.filter(isPosProduct)
        : [...products];

      if (catalogContext === "featured") {
        const opBase = products.filter((p) => p.featured || getProductFeaturedPriority(p) > 0);
        return opBase.sort((a, b) => {
          const diff = getProductFeaturedPriority(b) - getProductFeaturedPriority(a);
          if (diff !== 0) return diff;
          const marginDiff = (productMargins[b.id] ?? globalMargin) - (productMargins[a.id] ?? globalMargin);
          if (marginDiff !== 0) return marginDiff;
          return a.name.localeCompare(b.name, "es");
        });
      }

      if (catalogContext === "pos") {
        const relevanceScore = (product: Product) => {
          const bag = normalizePortalText([product.category, product.name, product.description, product.sku, (product.tags ?? []).join(" ")].join(" "));
          const categoryNorm = normalizePortalText(product.category);
          let score = 0;
          if (categoryNorm.includes("punto de venta")) score += 8;
          if (hasWord(categoryNorm, "pos")) score += 6;

          const kws: Array<[string, number]> = [
            ["terminal", 5], ["monitor tactil", 5], ["touch", 4], ["barcode", 4],
            ["scanner", 4], ["lector", 4], ["impresora termica", 5], ["thermal", 4],
            ["ticket", 3], ["cajon", 3], ["pos", 3],
          ];
          for (const [kw, w] of kws) if (bag.includes(kw)) score += w;
          return score;
        };

        const comboScore = (product: Product) => {
          const bag = normalizePortalText([product.name, product.description, (product.tags ?? []).join(" ")].join(" "));
          return /(kit|combo|bundle|pack)/.test(bag) ? 1 : 0;
        };

        return contextBase.sort((a, b) => {
          const comboDiff = comboScore(b) - comboScore(a);
          if (comboDiff !== 0) return comboDiff;
          const relDiff = relevanceScore(b) - relevanceScore(a);
          if (relDiff !== 0) return relDiff;
          const salesDiff = (purchaseHistory[b.id] ?? 0) - (purchaseHistory[a.id] ?? 0);
          if (salesDiff !== 0) return salesDiff;
          const featDiff = getProductFeaturedPriority(b) - getProductFeaturedPriority(a);
          if (featDiff !== 0) return featDiff;
          return a.name.localeCompare(b.name, "es");
        });
      }

      const visible = hiddenProductIds.size > 0
        ? contextBase.filter((p) => !hiddenProductIds.has(p.id))
        : contextBase;

      return visible;
    },
    [catalogContext, products, isPosProduct, hiddenProductIds]
  );

  const hasActiveFilters = categoryFilter !== "all" || brandFilter !== "all" || minPrice !== "" || maxPrice !== "";

  function clearFilters() {
    setCategoryFilter("all");
    setBrandFilter("all");
    setMinPrice("");
    setMaxPrice("");
  }

  return {
    // Filter state
    categoryFilter, setCategoryFilter,
    brandFilter, setBrandFilter,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    expandedParents, setExpandedParents,
    hasActiveFilters,
    clearFilters,
    // Category data
    categoryTree,
    parentChildrenMap,
    categoryCounts,
    // Brand data
    brands,
    brandCounts,
    activeBrandsWithProducts,
    // Products
    products,
    totalCount,
    productsLoading,
    hasMore,
    loadMore,
    productsError,
    // Helpers
    isPosProduct,
    displayProducts,
  };
}
