export interface PosSubcategory {
  id: string;
  name: string;
  order: number;
}

export interface PosProductEntry {
  productId: number;
  subcategoryId: string;
}

export interface PosKitItem {
  productId: number;
  qty: number;
}

export interface PosKit {
  id: string;
  name: string;
  description: string;
  items: PosKitItem[];
  manualPrice: number | null;
  discountPct: number;
  active: boolean;
  createdAt: string;
}

export type PosRuleType = "cross-sell" | "upsell" | "complement";

export interface PosRule {
  id: string;
  baseProductId: number;
  suggestedProductIds: number[];
  type: PosRuleType;
  priority: number;
  active: boolean;
}

// ── localStorage helpers ────────────────────────────────────────────────────

const KEYS = {
  subcategories: "pos_subcategories_v1",
  products:      "pos_products_v1",
  kits:          "pos_kits_v1",
  rules:         "pos_rules_v1",
} as const;

const DEFAULT_SUBCATEGORIES: PosSubcategory[] = [
  { id: "pos-printers",  name: "Impresoras térmicas", order: 0 },
  { id: "pos-scanners",  name: "Lectores de código",  order: 1 },
  { id: "pos-drawers",   name: "Cajones de dinero",   order: 2 },
  { id: "pos-terminals", name: "Terminales POS",      order: 3 },
  { id: "pos-monitors",  name: "Monitores táctiles",  order: 4 },
];

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const posStorage = {
  loadSubcategories: (): PosSubcategory[] =>
    load(KEYS.subcategories, DEFAULT_SUBCATEGORIES),
  saveSubcategories: (v: PosSubcategory[]) => save(KEYS.subcategories, v),

  loadProducts: (): PosProductEntry[] =>
    load(KEYS.products, []),
  saveProducts: (v: PosProductEntry[]) => save(KEYS.products, v),

  loadKits: (): PosKit[] =>
    load(KEYS.kits, []),
  saveKits: (v: PosKit[]) => save(KEYS.kits, v),

  loadRules: (): PosRule[] =>
    load(KEYS.rules, []),
  saveRules: (v: PosRule[]) => save(KEYS.rules, v),
};
