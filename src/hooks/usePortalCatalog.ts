/**
 * usePortalCatalog — Manages catalog state for the B2B portal.
 * Encapsulates: category tree, brand/category counts, filters, display product sorting.
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
  search?: string;
}

export function usePortalCatalog({
  catalogContext,
  isAdmin = false,
  hiddenProductIds = new Set(),
  search = "",
}: UsePortalCatalogOptions) {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaFromUrl = searchParams.get("categoria") || "all";

  const [categoryFilter, _setCategoryFilter] = useState(categoriaFromUrl);
  
  // Custom setter that also updates URL
  const setCategoryFilter = useCallback((val: string) => {
    _setCategoryFilter(val);
    const params = new URLSearchParams(window.location.search);
    if (val === "all") {
      params.delete("categoria");
    } else {
      params.set("categoria", val);
    }
    setSearchParams(params);
  }, [setSearchParams]);

  // Sync state if URL changes (browser back/forward)
  useEffect(() => {
    if (categoriaFromUrl !== categoryFilter) {
      _setCategoryFilter(categoriaFromUrl);
    }
  }, [categoriaFromUrl]);

  const [brandFilter, setBrandFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [subCategoryFilters, setSubCategoryFilters] = useState<string[]>([]);
  const [page, setPage] = useState(0);

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
    // 1. Children lookup map
    const childrenByParentId = new Map<number | null, DbCat[]>();
    dbCats.forEach((cat) => {
      const list = childrenByParentId.get(cat.parent_id) ?? [];
      list.push(cat);
      childrenByParentId.set(cat.parent_id, list);
    });

    // 2. Recursive products check (to hide empty branches)
    const hasProductsRecursive = (cat: DbCat): boolean => {
      if ((serverCategoryCounts[cat.name] || 0) > 0) return true;
      const children = childrenByParentId.get(cat.id) || [];
      return children.some((child) => hasProductsRecursive(child));
    };

    // 3. Root nodes
    const rootNodes = (childrenByParentId.get(null) || [])
      .filter((root) => hasProductsRecursive(root))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    // 4. Parents hierarchy: Root > Level 1 > Level 2
    const parents = rootNodes.map((root) => {
      const level1Children = (childrenByParentId.get(root.id) || [])
        .filter((child) => hasProductsRecursive(child))
        .map((child) => {
          const level2Children = (childrenByParentId.get(child.id) || [])
            .filter((sub) => hasProductsRecursive(sub))
            .map((sub) => ({ id: sub.id, name: sub.name, slug: sub.slug }))
            .sort((a, b) => a.name.localeCompare(b.name, "es"));
          
          return { id: child.id, name: child.name, slug: child.slug, children: level2Children };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      
      return { id: root.id, name: root.name, slug: root.slug, children: level1Children };
    });

    const standalone = Object.keys(serverCategoryCounts)
      .filter((name) => !dbCats.some(c => c.name === name))
      .map(name => {
        const cat = dbCats.find(c => c.name === name);
        return { id: cat?.id || 0, name, slug: cat?.slug || null };
      });

    return { parents, leaves: standalone.sort((a, b) => a.name.localeCompare(b.name, "es")) };
  }, [dbCats, serverCategoryCounts]);

  // Expose immediate children of the ACTIVE category for sub-filtering
  const activeCategoryChildren = useMemo(() => {
    if (categoryFilter === "all" || dbCats.length === 0) return [];
    
    // Find active category by name or slug
    const activeCat = dbCats.find(c => 
      c.name === categoryFilter || 
      c.slug === categoryFilter || 
      normalizePortalText(c.name) === normalizePortalText(categoryFilter) ||
      normalizePortalText(c.slug) === normalizePortalText(categoryFilter)
    );
    if (!activeCat) return [];
    
    return dbCats
      .filter(c => c.parent_id === activeCat.id)
      .filter(c => {
        // Recursive check: child must have products in its branch
        const childrenByParentId = new Map<number | null, DbCat[]>();
        dbCats.forEach((cat) => {
          const list = childrenByParentId.get(cat.parent_id) ?? [];
          list.push(cat);
          childrenByParentId.set(cat.parent_id, list);
        });
        const hasProductsRecursive = (cat: DbCat): boolean => {
          if ((serverCategoryCounts[cat.name] || 0) > 0) return true;
          const children = childrenByParentId.get(cat.id) || [];
          return children.some((child) => hasProductsRecursive(child));
        };
        return hasProductsRecursive(c);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [categoryFilter, dbCats, serverCategoryCounts]);

  // When categoryFilter changes, reset sub-filters
  useEffect(() => {
    setSubCategoryFilters([]);
  }, [categoryFilter]);

  // parentChildrenMap — Maps EVERY category name to its full list of recursive descendants (for search)
  const parentChildrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    
    const childrenByParentId = new Map<number | null, DbCat[]>();
    dbCats.forEach((cat) => {
      const list = childrenByParentId.get(cat.parent_id) ?? [];
      list.push(cat);
      childrenByParentId.set(cat.parent_id, list);
    });

    dbCats.forEach((cat) => {
      const descendants: string[] = [cat.name];
      const stack = [cat.id];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const children = childrenByParentId.get(currentId) || [];
        children.forEach((child) => {
          descendants.push(child.name);
          stack.push(child.id);
        });
      }
      map[cat.name] = descendants;
    });

    return map;
  }, [dbCats]);

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

  const posCategoryValues = useMemo(() => {
    if (dbCats.length === 0) return [] as string[];
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
        out.add(current.name);
        for (const child of dbCats) {
          if (child.parent_id === currentId) stack.push(child.id);
        }
      }
    }
    return Array.from(out);
  }, [dbCats]);

  const queryCategory = useMemo(() => {
    if (subCategoryFilters.length > 0) {
      const allSubDescendants = subCategoryFilters.flatMap(name => parentChildrenMap[name] || [name]);
      return [...new Set(allSubDescendants)];
    }

    if (categoryFilter !== "all") {
      // Find the real name from slug/name to look up in parentChildrenMap
      const activeCat = dbCats.find(c => 
        c.name === categoryFilter || 
        c.slug === categoryFilter ||
        normalizePortalText(c.name) === normalizePortalText(categoryFilter) ||
        normalizePortalText(c.slug) === normalizePortalText(categoryFilter)
      );
      const nameToQuery = activeCat ? activeCat.name : categoryFilter;
      return parentChildrenMap[nameToQuery] || nameToQuery;
    }

    if (catalogContext === "pos" && posCategoryValues.length > 0) {
      return posCategoryValues;
    }

    return "all";
  }, [catalogContext, categoryFilter, parentChildrenMap, posCategoryValues, dbCats]);

  // ── Products fetch ────────────────────────────────────────────────────────
  const {
    products,
    totalCount,
    loading: productsLoading,
    hasMore,
    loadMore,
    error: productsError,
  } = useProducts({
    category: queryCategory,
    brand: brandFilter,
    search: search,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    pageSize: 200,
    page: page,
    isAdmin,
    isFeatured: catalogContext === "featured",
    sortBy: catalogContext === "featured" ? "featured" : "name",
  });

  const { brands } = useBrands();

  // ── Counts ────────────────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: totalCount };

    if (Object.keys(serverCategoryCounts).length > 0) {
      // 1. Standalone counts
      Object.entries(serverCategoryCounts).forEach(([cat, count]) => {
        counts[cat] = count;
      });

      // 2. Hierarchical counts for all known categories
      Object.keys(parentChildrenMap).forEach((name) => {
        const descendants = parentChildrenMap[name];
        counts[name] = descendants.reduce((sum, d) => sum + (serverCategoryCounts[d] || 0), 0);
      });
    } else {
      products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    }

    return counts;
  }, [totalCount, serverCategoryCounts, parentChildrenMap, products]);

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

  const hasActiveFilters = categoryFilter !== "all" || brandFilter !== "all" || minPrice !== "" || maxPrice !== "" || subCategoryFilters.length > 0;

  function clearFilters() {
    setCategoryFilter("all");
    setSubCategoryFilters([]);
    setBrandFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setPage(0);
  }

  // Reset page on filters change
  useEffect(() => {
    setPage(0);
  }, [categoryFilter, subCategoryFilters, brandFilter, minPrice, maxPrice, search, catalogContext]);

  return {
    // Filter state
    categoryFilter, setCategoryFilter,
    subCategoryFilters, setSubCategoryFilters,
    activeCategoryChildren,
    brandFilter, setBrandFilter,
    minPrice, setMinPrice,
    maxPrice, setMaxPrice,
    expandedParents, setExpandedParents,
    page, setPage,
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
