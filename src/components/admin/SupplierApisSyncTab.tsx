import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  RefreshCw,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useAirSync } from "@/hooks/useAirSync";
import { useElitSync } from "@/hooks/useElitSync";
import { useInvidSync } from "@/hooks/useInvidSync";
import { fetchAirProductsPage, type AirProduct } from "@/lib/api/airApi";
import { fetchElitProductsPagePayload, type ElitProduct, type ElitProductsQuery } from "@/lib/api/elitApi";
import { supabase } from "@/lib/supabase";

interface Props {
  isDark?: boolean;
  userId?: string;
  onSyncDone?: () => void;
}

type PreviewSupplier = "air" | "elit";
type ElitSearchField = "nombre" | "marca" | "codigo_producto";

interface PreviewItem<T> {
  key: string;
  sku: string;
  name: string;
  brand: string;
  imageUrl?: string;
  cost: number;
  currency: "USD" | "ARS";
  stock: number;
  stockSecondary?: number;
  stockSecondaryLabel?: string;
  raw: T;
}

interface SystemCatalogProduct {
  id: number;
  sku: string | null;
  name: string;
  name_original?: string | null;
  external_id?: string | null;
  cost_price: number;
  specs?: Record<string, unknown> | null;
}

interface SystemProductMatch {
  product: SystemCatalogProduct;
  mode: "strong" | "model" | "name_exact" | "name_fuzzy";
  score: number;
  sharedModelKeys?: string[];
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Esperando",
  checking: "Validando credenciales...",
  fetching: "Descargando productos...",
  upserting: "Consolidando proveedores...",
  done: "Sync completado",
  error: "Sync con errores",
};

const AIR_PAGE_SIZE = 500;
const ELIT_PAGE_SIZE = 100;

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function parseProviderNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getElitAvailability(
  immediateRaw: unknown,
  delayedRaw: unknown,
  totalRaw: unknown,
  levelRaw: unknown
): { immediate: number; delayed: number; total: number; available: number } {
  const immediate = Math.max(0, Math.round(parseProviderNumber(immediateRaw)));
  const delayed = Math.max(0, Math.round(parseProviderNumber(delayedRaw)));
  const total = Math.max(0, Math.round(parseProviderNumber(totalRaw)));
  const merged = Math.max(total, immediate + delayed);
  if (merged > 0) {
    return { immediate, delayed, total, available: merged };
  }

  const level = String(levelRaw ?? "").trim().toLowerCase();
  if (level === "alto" || level === "medio") {
    return { immediate, delayed, total, available: 1 };
  }

  return { immediate, delayed, total, available: 0 };
}

function tokenizeName(value: unknown): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9]+/g, ""))
    .filter((token) => token.length >= 3);
}

function nameSimilarity(a: unknown, b: unknown): { ratio: number; shared: number } {
  const aTokens = new Set(tokenizeName(a));
  const bTokens = new Set(tokenizeName(b));
  if (aTokens.size === 0 || bTokens.size === 0) {
    return { ratio: 0, shared: 0 };
  }

  let shared = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) shared++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return { ratio: union > 0 ? shared / union : 0, shared };
}

type ProductFamily =
  | "storage"
  | "cpu"
  | "notebook"
  | "desktop"
  | "monitor"
  | "memory"
  | "motherboard"
  | "gpu"
  | "network";

function inferProductFamily(value: unknown): ProductFamily | null {
  const tokens = new Set(tokenizeName(value));
  if (tokens.size === 0) return null;

  const has = (k: string) => tokens.has(k);
  if (has("notebook") || has("laptop") || has("ultrabook")) return "notebook";
  if (has("desktop") || has("aio") || has("allinone")) return "desktop";
  if (has("monitor") || has("display") || has("pantalla")) return "monitor";
  if (has("procesador") || has("cpu") || has("ryzen") || has("athlon") || has("celeron") || has("pentium") || has("xeon")) return "cpu";
  if (has("gpu") || has("geforce") || has("radeon")) return "gpu";
  if (has("motherboard") || has("placa") || has("mainboard")) return "motherboard";
  if (has("ram") || has("ddr4") || has("ddr5") || has("memoria")) return "memory";
  if (has("router") || has("switch") || has("accesspoint") || has("wifi")) return "network";
  if (has("ssd") || has("nvme") || has("hdd") || has("disco") || has("sata") || has("m2")) return "storage";
  return null;
}

function parseCapacityGbFromText(value: unknown): number[] {
  const text = normalizeText(String(value ?? "")).replace(/,/g, ".");
  if (!text) return [];

  const out: number[] = [];
  const pushCapacity = (rawAmount: string, unit: "tb" | "gb" | "g" | "t0") => {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const gb = (unit === "tb" || unit === "t0") ? amount * 1024 : amount;
    out.push(Math.round(gb));
  };

  const commonRegex = /(\d+(?:\.\d+)?)\s*(tb|gb|g)\b/g;
  let match: RegExpExecArray | null = null;
  while ((match = commonRegex.exec(text)) !== null) {
    pushCapacity(match[1], match[2] as "tb" | "gb" | "g");
  }

  // Some SKUs encode TB as T0 (zero), e.g. SFYR2S/4T0.
  const skuRegex = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*t0\b/g;
  while ((match = skuRegex.exec(text)) !== null) {
    pushCapacity(match[1], "t0");
  }

  return out;
}

function resolvePreviewCapacityGb(item: PreviewItem<AirProduct | ElitProduct>): number | null {
  const raw = (item.raw && typeof item.raw === "object") ? (item.raw as Record<string, unknown>) : {};
  const all = [
    item.name,
    item.sku,
    raw.codigo_producto,
    raw.codigo_alfa,
    raw.part_number,
    raw.supplier_sku,
  ].flatMap((candidate) => parseCapacityGbFromText(candidate));
  if (all.length === 0) return null;
  return Math.max(...all);
}

function isGenericModelToken(token: string): boolean {
  if (!token) return true;
  if (/^(19|20)\d{2}$/.test(token)) return true;
  if (/^\d{1,3}$/.test(token)) return true;
  if (/^\d{1,4}(gb|tb|mhz|ghz|hz|w|mp|fps)$/.test(token)) return true;
  return false;
}

function extractModelTokens(value: unknown): string[] {
  const normalized = normalizeText(String(value ?? ""));
  if (!normalized) return [];

  const out = new Set<string>();
  const rawTokens = normalized.match(/[a-z0-9]+/g) ?? [];
  for (const rawToken of rawTokens) {
    const token = normalizeToken(rawToken);
    if (!token) continue;
    if (token.length < 3 || token.length > 20) continue;
    if (!/\d/.test(token) || !/[a-z]/.test(token)) continue;
    if (isGenericModelToken(token)) continue;
    out.add(token);

    const tail = token.match(/(\d{2,6}[a-z]{1,3})$/);
    if (tail?.[1] && !isGenericModelToken(tail[1])) {
      out.add(tail[1]);
    }

    const numericTail = token.match(/(\d+)([a-z]{1,3})$/);
    if (numericTail) {
      const digits = numericTail[1];
      const letters = numericTail[2];
      const allowShortTail = !["g", "gb", "tb", "mhz", "ghz", "hz"].includes(letters);
      if (!allowShortTail) continue;
      for (const size of [6, 5, 4, 3]) {
        if (digits.length >= size) {
          const tailDigits = digits.slice(-size);
          if (tailDigits.startsWith("0")) continue;
          const shortTail = `${tailDigits}${letters}`;
          if (!isGenericModelToken(shortTail)) {
            out.add(shortTail);
          }
        }
      }
    }
  }

  return Array.from(out);
}

function evaluateModelKeyMatch(aKeys: string[], bKeys: string[]): { score: number; sharedKeys: string[]; maxLen: number } {
  if (aKeys.length === 0 || bKeys.length === 0) {
    return { score: 0, sharedKeys: [], maxLen: 0 };
  }

  const bSet = new Set(bKeys);
  const sharedKeys: string[] = [];
  let score = 0;
  let maxLen = 0;

  for (const key of aKeys) {
    if (!bSet.has(key)) continue;
    sharedKeys.push(key);
    maxLen = Math.max(maxLen, key.length);
    if (key.length >= 8) score += 1.25;
    else if (key.length >= 6) score += 1;
    else if (key.length >= 4) score += 0.75;
    else score += 0.5;
  }

  return {
    score: Number(score.toFixed(3)),
    sharedKeys,
    maxLen,
  };
}

function readSpecString(specs: Record<string, unknown> | null | undefined, key: string): string {
  const raw = specs?.[key];
  return typeof raw === "string" ? raw : "";
}

function getSystemBrandToken(product: SystemCatalogProduct): string {
  const bySpecs = normalizeToken(
    readSpecString(product.specs, "supplier_brand") ||
    readSpecString(product.specs, "elit_brand") ||
    readSpecString(product.specs, "air_group") ||
    readSpecString(product.specs, "brand")
  );
  if (bySpecs) return bySpecs;
  return inferBrandTokenFromText(product.name_original || product.name);
}

const KNOWN_BRAND_TOKENS = new Set([
  "hp", "lenovo", "dell", "msi", "asus", "acer", "samsung", "lg", "apple", "huawei",
  "intel", "amd", "kingston", "adata", "bwin", "hikvision", "ezviz", "cudy",
  "coolermaster", "asrock", "biostar", "gigabyte", "corsair", "sandisk", "wd",
  "seagate", "epson", "canon", "brother", "cx", "noga", "logitech", "tplink", "tp",
]);

const GENERIC_LEADING_TOKENS = new Set([
  "notebook", "laptop", "ultrabook", "pc", "cpu", "procesador", "disco", "ssd", "hdd",
  "monitor", "memoria", "ram", "placa", "motherboard", "router", "switch", "accesspoint",
  "accespoint", "adaptador", "fuente", "gabinete", "cooler", "teclado", "mouse",
  "pulgada", "pulgadas", "inch", "inches", "modelo", "model", "serie", "version",
]);

function inferBrandTokenFromText(value: unknown): string {
  const tokens = tokenizeName(value);
  if (tokens.length === 0) return "";

  for (const token of tokens) {
    if (KNOWN_BRAND_TOKENS.has(token)) return token;
  }

  for (const token of tokens) {
    if (GENERIC_LEADING_TOKENS.has(token)) continue;
    if (/^\d/.test(token)) continue;
    if (token.length < 2 || token.length > 14) continue;
    return token;
  }

  return "";
}

function getPreviewBrandToken(item: PreviewItem<AirProduct | ElitProduct>): string {
  return normalizeToken(item.brand) || inferBrandTokenFromText(item.name);
}

function getSystemModelKeys(product: SystemCatalogProduct): string[] {
  const out = new Set<string>();
  const candidates = [
    product.sku,
    product.external_id,
    readSpecString(product.specs, "manufacturer_part_number"),
    readSpecString(product.specs, "supplier_sku"),
    readSpecString(product.specs, "air_part_number"),
    product.name_original || product.name,
  ];

  for (const candidate of candidates) {
    for (const token of extractModelTokens(candidate)) {
      out.add(token);
    }
  }

  return Array.from(out);
}

function resolveSystemCapacityGb(product: SystemCatalogProduct): number | null {
  const all = [
    product.name_original || product.name,
    product.sku,
    product.external_id,
    readSpecString(product.specs, "capacity"),
    readSpecString(product.specs, "capacity_gb"),
    readSpecString(product.specs, "supplier_sku"),
    readSpecString(product.specs, "manufacturer_part_number"),
  ].flatMap((candidate) => parseCapacityGbFromText(candidate));
  if (all.length === 0) return null;
  return Math.max(...all);
}

function isCapacityCompatible(
  family: ProductFamily | null,
  leftGb: number | null,
  rightGb: number | null
): boolean {
  if (!family || (family !== "storage" && family !== "memory")) return true;
  if (!leftGb) return true;
  if (!rightGb) return false;
  const maxValue = Math.max(leftGb, rightGb);
  const diff = Math.abs(leftGb - rightGb);
  return diff <= 64 || diff / maxValue <= 0.1;
}

export function SupplierApisSyncTab({ isDark = true, userId, onSyncDone }: Props) {
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const air = useAirSync(userId);
  const elit = useElitSync(userId);
  const invid = useInvidSync(userId);
  const [previewSupplier, setPreviewSupplier] = useState<PreviewSupplier | null>(null);
  const [previewItems, setPreviewItems] = useState<Array<PreviewItem<AirProduct | ElitProduct>>>([]);
  const [previewSelected, setPreviewSelected] = useState<Set<string>>(new Set());
  const [previewForceCreate, setPreviewForceCreate] = useState<Set<string>>(new Set());
  const [previewCursor, setPreviewCursor] = useState(0);
  const [previewHasMore, setPreviewHasMore] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSyncing, setPreviewSyncing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [elitSearchField, setElitSearchField] = useState<ElitSearchField>("nombre");
  const [systemCatalog, setSystemCatalog] = useState<SystemCatalogProduct[]>([]);
  const [systemCatalogLoading, setSystemCatalogLoading] = useState(false);
  const [systemCatalogError, setSystemCatalogError] = useState("");
  const previewRequestLockRef = useRef(false);
  const previewMatchCacheRef = useRef(new Map<string, SystemProductMatch | null>());

  const isAnySyncRunning = air.running || elit.running || invid.running || previewSyncing;

  const systemIndexes = useMemo(() => {
    const byStrongKey = new Map<string, SystemCatalogProduct>();
    const byName = new Map<string, SystemCatalogProduct>();
    const byModelKey = new Map<string, SystemCatalogProduct[]>();

    const addStrongKey = (raw: unknown, product: SystemCatalogProduct) => {
      const key = normalizeToken(raw);
      if (!key) return;
      const current = byStrongKey.get(key);
      if (!current || product.cost_price < current.cost_price) {
        byStrongKey.set(key, product);
      }
    };

    for (const product of systemCatalog) {
      addStrongKey(product.sku, product);
      addStrongKey(product.external_id, product);
      addStrongKey(readSpecString(product.specs, "manufacturer_part_number"), product);
      addStrongKey(readSpecString(product.specs, "supplier_sku"), product);
      addStrongKey(readSpecString(product.specs, "supplier_external_id"), product);
      addStrongKey(readSpecString(product.specs, "ean"), product);
      addStrongKey(readSpecString(product.specs, "gtin"), product);
      addStrongKey(readSpecString(product.specs, "upc"), product);

      const nameKey = normalizeText(product.name_original || product.name);
      if (nameKey && nameKey.length >= 8 && !byName.has(nameKey)) {
        byName.set(nameKey, product);
      }

      for (const modelKey of getSystemModelKeys(product)) {
        const list = byModelKey.get(modelKey) ?? [];
        if (!list.some((existing) => existing.id === product.id)) {
          list.push(product);
          byModelKey.set(modelKey, list);
        }
      }
    }

    return { byStrongKey, byName, byModelKey };
  }, [systemCatalog]);

  useEffect(() => {
    previewMatchCacheRef.current.clear();
  }, [systemCatalog, previewSupplier]);

  async function handleAirCatalog() {
    await air.runCatalogSync();
    onSyncDone?.();
  }

  async function handleAirDelta() {
    await air.runSypSync();
    onSyncDone?.();
  }

  async function handleElitCatalog() {
    await elit.runCatalogSync();
    onSyncDone?.();
  }

  async function handleElitDelta() {
    await elit.runDeltaSync();
    onSyncDone?.();
  }

  async function handleInvidCatalog() {
    await invid.runCatalogSync();
    onSyncDone?.();
  }

  function resetPreviewState(supplier: PreviewSupplier) {
    setPreviewSupplier(supplier);
    setPreviewItems([]);
    setPreviewSelected(new Set());
    setPreviewForceCreate(new Set());
    setPreviewCursor(supplier === "air" ? 0 : 1);
    setPreviewHasMore(false);
    setPreviewError("");
    setPreviewQuery("");
    setPreviewTotal(null);
    setElitSearchField("nombre");
  }

  async function openPreview(supplier: PreviewSupplier) {
    if (isAnySyncRunning) return;
    resetPreviewState(supplier);
    if (systemCatalog.length === 0) {
      await loadSystemCatalog();
    }
    const initialCursor = supplier === "air" ? 0 : 1;
    await loadMorePreview(supplier, initialCursor, false);
  }

  async function loadSystemCatalog() {
    setSystemCatalogLoading(true);
    setSystemCatalogError("");
    try {
      const all: SystemCatalogProduct[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from("products")
          .select("id, sku, name, name_original, external_id, cost_price, specs")
          .order("id", { ascending: true })
          .range(from, to);

        if (error) {
          throw new Error(error.message);
        }

        const batch = (data ?? []) as SystemCatalogProduct[];
        all.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setSystemCatalog(all);
    } catch (error) {
      setSystemCatalogError(error instanceof Error ? error.message : String(error));
    } finally {
      setSystemCatalogLoading(false);
    }
  }

  function mapAirPreviewItem(product: AirProduct): PreviewItem<AirProduct> {
    const delayedStock = Number(product.lug?.disponible ?? 0);
    return {
      key: String(product.codigo ?? ""),
      sku: String(product.part_number ?? product.codigo ?? ""),
      name: String(product.descrip ?? "Producto AIR"),
      brand: String(product.grupo ?? "AIR"),
      imageUrl: "",
      cost: Number(product.precio ?? 0),
      currency: "USD",
      stock: Number(product.ros?.disponible ?? 0),
      stockSecondary: delayedStock > 0 ? delayedStock : undefined,
      stockSecondaryLabel: delayedStock > 0 ? "LUG" : undefined,
      raw: product,
    };
  }

  function mapElitPreviewItem(product: ElitProduct): PreviewItem<ElitProduct> {
    const isArs = String(product.moneda ?? "2") === "1";
    const stock = getElitAvailability(
      product.stock_deposito_cliente,
      product.stock_deposito_cd,
      product.stock_total,
      product.nivel_stock
    );
    return {
      key: String(product.id),
      sku: String(product.codigo_producto ?? product.codigo_alfa ?? product.id),
      name: String(product.nombre ?? "Producto ELIT"),
      brand: String(product.marca ?? "ELIT"),
      imageUrl: Array.isArray(product.miniaturas) && product.miniaturas.length > 0
        ? product.miniaturas[0]
        : Array.isArray(product.imagenes) && product.imagenes.length > 0
          ? product.imagenes[0]
          : "",
      cost: parseProviderNumber(product.precio ?? 0),
      currency: isArs ? "ARS" : "USD",
      stock: stock.available,
      stockSecondary: stock.delayed > 0 ? stock.delayed : undefined,
      stockSecondaryLabel: stock.delayed > 0 ? "CD" : undefined,
      raw: product,
    };
  }

  function buildElitSearchQuery(): ElitProductsQuery {
    const value = previewQuery.trim();
    if (!value) {
      return {};
    }

    if (elitSearchField === "marca") {
      return { marca: value };
    }

    if (elitSearchField === "codigo_producto") {
      return { codigo_producto: value };
    }

    return { nombre: value };
  }

  function getPreviewStrongKeys(item: PreviewItem<AirProduct | ElitProduct>): string[] {
    const raw = (item.raw && typeof item.raw === "object") ? (item.raw as Record<string, unknown>) : {};
    const keys = [
      item.sku,
      item.key,
      raw.codigo_producto,
      raw.codigo_alfa,
      raw.ean,
      raw.gtin,
      raw.upc,
      raw.part_number,
      raw.codigo,
      raw.id,
      raw.manufacturer_part_number,
      raw.supplier_sku,
    ];

    return [...new Set(keys.map(normalizeToken).filter(Boolean))];
  }

  function getPreviewModelKeys(item: PreviewItem<AirProduct | ElitProduct>): string[] {
    const raw = (item.raw && typeof item.raw === "object") ? (item.raw as Record<string, unknown>) : {};
    const out = new Set<string>();
    const candidates = [
      item.sku,
      item.name,
      raw.codigo_producto,
      raw.codigo_alfa,
      raw.part_number,
      raw.supplier_sku,
      raw.manufacturer_part_number,
      raw.air_part_number,
    ];

    for (const candidate of candidates) {
      for (const token of extractModelTokens(candidate)) {
        out.add(token);
      }
    }

    return Array.from(out);
  }

  function findSystemProduct(item: PreviewItem<AirProduct | ElitProduct>): SystemProductMatch | null {
    const cacheKey = `${previewSupplier ?? "none"}:${item.key}:${normalizeToken(item.sku)}:${normalizeToken(item.name)}:${normalizeToken(item.brand)}`;
    if (previewMatchCacheRef.current.has(cacheKey)) {
      return previewMatchCacheRef.current.get(cacheKey) ?? null;
    }

    const previewBrand = getPreviewBrandToken(item);
    const previewFamily = inferProductFamily(item.name);
    const previewCapacityGb = resolvePreviewCapacityGb(item);

    const strongKeys = getPreviewStrongKeys(item);
    for (const key of strongKeys) {
      const match = systemIndexes.byStrongKey.get(key);
      if (match) {
        const matchBrand = getSystemBrandToken(match);
        const hasBothBrands = Boolean(previewBrand && matchBrand);
        if (hasBothBrands && previewBrand !== matchBrand) {
          continue;
        }

        const matchFamily = inferProductFamily(match.name_original || match.name);
        if (previewFamily && matchFamily && previewFamily !== matchFamily) {
          continue;
        }
        const matchCapacityGb = resolveSystemCapacityGb(match);
        if (!isCapacityCompatible(previewFamily, previewCapacityGb, matchCapacityGb)) {
          continue;
        }

        const resolved: SystemProductMatch = { product: match, mode: "strong", score: 100 };
        previewMatchCacheRef.current.set(cacheKey, resolved);
        return resolved;
      }
    }

    const previewModelKeys = getPreviewModelKeys(item);
    if (previewModelKeys.length > 0) {
      const candidates = new Map<number, { product: SystemCatalogProduct; score: number }>();
      for (const modelKey of previewModelKeys) {
        const modelCandidates = systemIndexes.byModelKey.get(modelKey) ?? [];
        const tokenWeight = modelKey.length >= 8 ? 1.25 : modelKey.length >= 6 ? 1 : 0.75;
        for (const product of modelCandidates) {
          const productBrand = getSystemBrandToken(product);
          const hasBothBrands = Boolean(previewBrand && productBrand);
          if (hasBothBrands && previewBrand !== productBrand) {
            continue;
          }

          const productFamily = inferProductFamily(product.name_original || product.name);
          if (previewFamily && productFamily && previewFamily !== productFamily) {
            continue;
          }
          const productCapacityGb = resolveSystemCapacityGb(product);
          if (!isCapacityCompatible(previewFamily, previewCapacityGb, productCapacityGb)) {
            continue;
          }

          const existing = candidates.get(product.id);
          const brandBonus = hasBothBrands && previewBrand === productBrand ? 0.35 : 0;
          if (existing) {
            existing.score += tokenWeight + brandBonus;
          } else {
            candidates.set(product.id, { product, score: tokenWeight + brandBonus });
          }
        }
      }

      const sortedModelMatches = Array.from(candidates.values())
        .filter((item) => {
          const productBrand = getSystemBrandToken(item.product);
          const hasBothBrands = Boolean(previewBrand && productBrand);
          const productFamily = inferProductFamily(item.product.name_original || item.product.name);
          if (previewFamily && productFamily && previewFamily !== productFamily) {
            return false;
          }
          const productCapacityGb = resolveSystemCapacityGb(item.product);
          if (!isCapacityCompatible(previewFamily, previewCapacityGb, productCapacityGb)) {
            return false;
          }
          const modelMatch = evaluateModelKeyMatch(previewModelKeys, getSystemModelKeys(item.product));
          const relaxedWithBrand = hasBothBrands && previewBrand === productBrand && modelMatch.score >= 0.75 && modelMatch.maxLen >= 4;
          const strictWithoutBrand = modelMatch.score >= 2 || modelMatch.sharedKeys.length >= 2 || modelMatch.maxLen >= 7;
          return relaxedWithBrand || strictWithoutBrand;
        })
        .sort((a, b) => b.score - a.score || a.product.cost_price - b.product.cost_price);

      if (sortedModelMatches.length > 0) {
        const best = sortedModelMatches[0];
        const modelMatch = evaluateModelKeyMatch(previewModelKeys, getSystemModelKeys(best.product));
        const resolved: SystemProductMatch = {
          product: best.product,
          mode: "model",
          score: best.score,
          sharedModelKeys: modelMatch.sharedKeys,
        };
        previewMatchCacheRef.current.set(cacheKey, resolved);
        return resolved;
      }
    }

    const nameKey = normalizeText(item.name);
    if (nameKey && nameKey.length >= 8) {
      const exact = systemIndexes.byName.get(nameKey);
      if (exact) {
        const exactFamily = inferProductFamily(exact.name_original || exact.name);
        if (previewFamily && exactFamily && previewFamily !== exactFamily) {
          previewMatchCacheRef.current.set(cacheKey, null);
          return null;
        }
        const exactCapacityGb = resolveSystemCapacityGb(exact);
        if (!isCapacityCompatible(previewFamily, previewCapacityGb, exactCapacityGb)) {
          previewMatchCacheRef.current.set(cacheKey, null);
          return null;
        }
        const resolved: SystemProductMatch = { product: exact, mode: "name_exact", score: 50 };
        previewMatchCacheRef.current.set(cacheKey, resolved);
        return resolved;
      }

      const fuzzyMatches = systemCatalog
        .map((product) => {
          const productName = normalizeText(product.name_original || product.name);
          if (!productName || productName.length < 8) return null;

          const productBrand = getSystemBrandToken(product);
          const hasBothBrands = Boolean(previewBrand && productBrand);
          if (hasBothBrands && previewBrand !== productBrand) {
            return null;
          }
          const hasBrandSignal = hasBothBrands && previewBrand === productBrand;

          const productFamily = inferProductFamily(productName);
          if (previewFamily && productFamily && previewFamily !== productFamily) {
            return null;
          }
          const productCapacityGb = resolveSystemCapacityGb(product);
          if (!isCapacityCompatible(previewFamily, previewCapacityGb, productCapacityGb)) {
            return null;
          }

          const containsName =
            nameKey.includes(productName) ||
            productName.includes(nameKey);
          const similarity = nameSimilarity(nameKey, productName);
          const passesSimilarity = hasBrandSignal
            ? (
              containsName
                ? Math.min(nameKey.length, productName.length) >= 12
                : similarity.ratio >= 0.5 && similarity.shared >= 3
            )
            : (
              containsName
                ? Math.min(nameKey.length, productName.length) >= 16
                : similarity.ratio >= 0.82 && similarity.shared >= 4
            );

          if (!passesSimilarity) return null;

          return {
            product,
            score: similarity.ratio + (containsName ? 0.25 : 0) + (hasBrandSignal ? 0.2 : 0),
          };
        })
        .filter((item): item is { product: SystemCatalogProduct; score: number } => Boolean(item))
        .sort((a, b) => b.score - a.score || a.product.cost_price - b.product.cost_price);

      if (fuzzyMatches.length > 0) {
        const best = fuzzyMatches[0];
        const resolved: SystemProductMatch = {
          product: best.product,
          mode: "name_fuzzy",
          score: best.score,
        };
        previewMatchCacheRef.current.set(cacheKey, resolved);
        return resolved;
      }
    }

    previewMatchCacheRef.current.set(cacheKey, null);
    return null;
  }

  function getPreviewUsdBaseCost(item: PreviewItem<AirProduct | ElitProduct>): number | null {
    if (item.currency === "USD") {
      return Number(item.cost);
    }

    const raw = (item.raw && typeof item.raw === "object") ? (item.raw as Record<string, unknown>) : {};
    const fx = Number(raw.cotizacion ?? 0);
    if (!fx || fx <= 0) return null;
    return Number((item.cost / fx).toFixed(4));
  }

  function formatUsd(value: number): string {
    return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function loadMorePreview(
    supplier: PreviewSupplier = previewSupplier ?? "air",
    cursor: number = previewCursor,
    append = true
  ) {
    if (previewRequestLockRef.current || previewLoading) {
      return;
    }
    previewRequestLockRef.current = true;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      if (supplier === "air") {
        const batch = await fetchAirProductsPage(cursor);
        const mapped = batch.map(mapAirPreviewItem);
        setPreviewItems((prev) => (append ? [...prev, ...mapped] : mapped));
        setPreviewCursor(cursor + 1);
        setPreviewHasMore(batch.length === AIR_PAGE_SIZE);
        setPreviewTotal(null);
      } else {
        const page = await fetchElitProductsPagePayload(cursor, ELIT_PAGE_SIZE, buildElitSearchQuery());
        const batch = page.products;
        const mapped = batch.map(mapElitPreviewItem);
        const currentCount = append ? previewItems.length : 0;
        const nextCount = currentCount + mapped.length;
        const total = page.paginator?.total ?? null;

        setPreviewItems((prev) => (append ? [...prev, ...mapped] : mapped));
        setPreviewCursor(cursor + mapped.length);
        setPreviewTotal(total);
        setPreviewHasMore(total ? nextCount < total : batch.length === ELIT_PAGE_SIZE);
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      previewRequestLockRef.current = false;
      setPreviewLoading(false);
    }
  }

  async function runElitServerSearch() {
    if (previewSupplier !== "elit") return;
    setPreviewSelected(new Set());
    await loadMorePreview("elit", 1, false);
  }

  const filteredPreview = useMemo(() => {
    const q = previewQuery.trim().toLowerCase();
    if (!q) return previewItems;
    return previewItems.filter((item) =>
      [item.sku, item.name, item.brand].join(" ").toLowerCase().includes(q)
    );
  }, [previewItems, previewQuery]);

  function togglePreviewSelect(key: string) {
    setPreviewSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setPreviewForceCreate((forcePrev) => {
          const forceNext = new Set(forcePrev);
          forceNext.delete(key);
          return forceNext;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleForceCreate(key: string) {
    setPreviewForceCreate((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        setPreviewSelected((selectedPrev) => {
          const selectedNext = new Set(selectedPrev);
          selectedNext.add(key);
          return selectedNext;
        });
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleKeys = filteredPreview.map((item) => item.key);
    const allSelected = visibleKeys.every((key) => previewSelected.has(key));
    setPreviewSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleKeys.forEach((key) => next.delete(key));
        setPreviewForceCreate((forcePrev) => {
          const forceNext = new Set(forcePrev);
          visibleKeys.forEach((key) => forceNext.delete(key));
          return forceNext;
        });
      } else {
        visibleKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  }

  async function syncSelectedPreviewItems() {
    if (!previewSupplier || previewSelected.size === 0) return;
    setPreviewSyncing(true);
    setPreviewError("");
    try {
      const selectedItems = previewItems.filter((item) => previewSelected.has(item.key));
      const forceCreateExternalIds = selectedItems
        .filter((item) => previewForceCreate.has(item.key))
        .map((item) => item.key);
      if (previewSupplier === "air") {
        const selectedProducts = selectedItems.map((item) => item.raw as AirProduct);
        await air.runSelectedCatalogSync(selectedProducts, { forceCreateExternalIds });
      } else {
        const selectedProducts = selectedItems.map((item) => item.raw as ElitProduct);
        await elit.runSelectedCatalogSync(selectedProducts, { forceCreateExternalIds });
      }
      onSyncDone?.();
      setPreviewSupplier(null);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setPreviewSyncing(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h2 className={`font-bold text-base ${dk("text-white", "text-[#171717]")}`}>Sync de proveedores</h2>
        <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
          Consolida AIR y ELIT, compara costos en USD base y deja siempre la fuente mas conveniente como preferida.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SupplierCard
          name="AIR Intranet"
          detail="API AIR con base USD"
          color="green"
          progress={air.progress}
          lastSync={air.lastSync}
          running={air.running}
          onFullSync={handleAirCatalog}
          onDeltaSync={handleAirDelta}
          onPreview={() => openPreview("air")}
          fullLabel="Sync catalogo AIR"
          fullHelp="Descarga y consolida todo el catalogo AIR."
          deltaLabel="Sync precios/stock AIR"
          deltaHelp="Actualiza costos y stock sin reprocesar todo."
          previewLabel="Preview y seleccion"
          previewHelp="Muestra una vista previa para elegir que traer."
          isDark={isDark}
        />
        <SupplierCard
          name="ELIT"
          detail="API ELIT con costos en ARS o USD"
          color="blue"
          progress={elit.progress}
          lastSync={elit.lastSync}
          running={elit.running}
          onFullSync={handleElitCatalog}
          onDeltaSync={handleElitDelta}
          onPreview={() => openPreview("elit")}
          fullLabel="Sync catalogo ELIT"
          fullHelp="Descarga y consolida todo el catalogo ELIT."
          deltaLabel="Sync incremental ELIT"
          deltaHelp="Trae cambios recientes con sincronizacion incremental."
          previewLabel="Preview y seleccion"
          previewHelp="Muestra una vista previa para elegir que traer."
          isDark={isDark}
        />
        <SupplierCard
          name="INVID"
          detail="API INVID Computers"
          color="green"
          progress={invid.progress}
          lastSync={invid.lastSync}
          running={invid.running}
          onFullSync={handleInvidCatalog}
          onDeltaSync={async () => alert("La API de INVID no soporta sync incremental directo todavía.")}
          onPreview={async () => alert("Preview de INVID en desarrollo.")}
          fullLabel="Sync catalogo INVID"
          fullHelp="Descarga y consolida todos los artículos de INVID."
          deltaLabel="Sync rápido (ND)"
          deltaHelp="No disponible."
          previewLabel="Preview (ND)"
          previewHelp="No disponible."
          isDark={isDark}
        />
      </div>

      <div className={`rounded-xl px-5 py-4 text-xs border ${dk("bg-blue-500/8 border-blue-500/20 text-blue-300", "bg-blue-50 border-blue-200 text-blue-700")}`}>
        <p className="font-semibold mb-2">Criterio de consolidacion</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Los productos equivalentes se buscan por SKU, part number, EAN/GTIN, external_id y similitud de nombre/marca.</li>
          <li>Los costos se comparan en USD base para que AIR y ELIT compitan en la misma moneda.</li>
          <li>El producto canonico sigue siendo editable desde admin: nombre, descripcion y categoria no se pisan en syncs posteriores.</li>
        </ul>
      </div>

      {previewSupplier && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className={`w-full max-w-6xl max-h-[90vh] rounded-2xl border flex flex-col overflow-hidden ${dk("bg-[#101010] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
            <div className={`px-5 py-4 border-b flex items-center justify-between ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <div>
                <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
                  Preview catalogo {previewSupplier === "air" ? "AIR" : "ELIT"}
                </h3>
                <p className={`text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                  Selecciona los productos que queres sincronizar antes de tocar el catalogo.
                </p>
              </div>
              <button
                onClick={() => setPreviewSupplier(null)}
                className={`rounded-lg p-1.5 transition ${dk("text-gray-500 hover:text-white hover:bg-[#1a1a1a]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={previewQuery}
                  onChange={(event) => setPreviewQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && previewSupplier === "elit") {
                      void runElitServerSearch();
                    }
                  }}
                  placeholder="Buscar por SKU, nombre o marca..."
                  className={`w-full sm:w-80 border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#141414] border-[#2a2a2a] text-white placeholder:text-[#4a4a4a]", "bg-white border-[#dcdcdc] text-[#171717] placeholder:text-[#a3a3a3]")}`}
                />
                {previewSupplier === "elit" && (
                  <>
                    <select
                      value={elitSearchField}
                      onChange={(event) => setElitSearchField(event.target.value as ElitSearchField)}
                      className={`text-xs rounded-lg border px-2 py-2 ${dk("border-[#2a2a2a] bg-[#141414] text-gray-300", "border-[#dcdcdc] bg-white text-[#171717]")}`}
                    >
                      <option value="nombre">Nombre</option>
                      <option value="marca">Marca</option>
                      <option value="codigo_producto">SKU</option>
                    </select>
                    <button
                      onClick={() => void runElitServerSearch()}
                      className={`text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]", "border-[#dcdcdc] text-[#171717] hover:bg-[#f5f5f5]")}`}
                    >
                      Buscar API
                    </button>
                  </>
                )}
                <button
                  onClick={toggleSelectAllVisible}
                  className={`text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]", "border-[#dcdcdc] text-[#171717] hover:bg-[#f5f5f5]")}`}
                >
                  Seleccionar visibles
                </button>
                <button
                  onClick={() => { void loadMorePreview(); }}
                  disabled={previewLoading || !previewHasMore}
                  className={`text-xs px-3 py-2 rounded-lg border transition disabled:opacity-40 ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]", "border-[#dcdcdc] text-[#171717] hover:bg-[#f5f5f5]")}`}
                >
                  {previewLoading ? "Cargando..." : previewHasMore ? "Traer mas" : "Sin mas paginas"}
                </button>
                <div className={`ml-auto text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                  {previewSelected.size} seleccionados / {filteredPreview.length} visibles
                  {previewTotal ? ` (de ${previewTotal})` : ""}
                  {previewForceCreate.size > 0 ? ` · forzar alta: ${previewForceCreate.size}` : ""}
                </div>
              </div>

              <div className={`text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
                {systemCatalogLoading
                  ? "Cargando catalogo interno para comparacion de precios..."
                  : `Catalogo interno cargado: ${systemCatalog.length.toLocaleString("es-AR")} productos`}
              </div>

              {systemCatalogError && (
                <div className={`rounded-lg px-3 py-2 text-xs ${dk("bg-amber-500/10 text-amber-300", "bg-amber-50 text-amber-700")}`}>
                  No se pudo cargar comparacion interna: {systemCatalogError}
                </div>
              )}

              {previewError && (
                <div className={`rounded-lg px-3 py-2 text-xs ${dk("bg-red-500/10 text-red-400", "bg-red-50 text-red-600")}`}>
                  {previewError}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto px-5 pb-4">
              <table className="w-full text-sm min-w-[1080px]">
                <thead className={`text-left text-[11px] uppercase tracking-wider ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                  <tr>
                    <th className="py-2 w-10">Sel</th>
                    <th className="py-2 w-24">Forzar alta</th>
                    <th className="py-2 w-14">Img</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2">Nombre</th>
                    <th className="py-2">Marca</th>
                    <th className="py-2 text-right">Costo</th>
                    <th className="py-2 text-right">Sistema (USD)</th>
                    <th className="py-2 text-right">Dif.</th>
                    <th className="py-2 text-center">Moneda</th>
                    <th className="py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPreview.map((item) => {
                    const systemMatch = findSystemProduct(item);
                    const systemProduct = systemMatch?.product ?? null;
                    const providerUsd = getPreviewUsdBaseCost(item);
                    const systemUsd = systemProduct?.cost_price ?? null;
                    const hasComparable = providerUsd !== null && systemUsd !== null && systemUsd > 0;
                    const deltaPct = hasComparable ? ((providerUsd - systemUsd) / systemUsd) * 100 : null;

                    return (
                    <tr key={item.key} className={`border-t ${dk("border-[#1d1d1d]", "border-[#eeeeee]")}`}>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={previewSelected.has(item.key)}
                          onChange={() => togglePreviewSelect(item.key)}
                          className="accent-[#2D9F6A]"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={previewForceCreate.has(item.key)}
                          onChange={() => toggleForceCreate(item.key)}
                          className="accent-amber-500"
                          title="Forzar alta como producto nuevo"
                        />
                      </td>
                      <td className="py-2">
                        <div className={`h-10 w-10 rounded-md border overflow-hidden ${dk("border-[#2a2a2a] bg-[#151515]", "border-[#e5e5e5] bg-[#f8f8f8]")}`}>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className={`h-full w-full flex items-center justify-center text-[10px] ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                              Sin img
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`py-2 font-mono text-xs ${dk("text-gray-300", "text-[#525252]")}`}>{item.sku || "sin-sku"}</td>
                      <td className={`py-2 ${dk("text-white", "text-[#171717]")}`}>
                        <div>{item.name}</div>
                        {systemProduct ? (
                          <div className={`text-[11px] mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
                            Compara con: {(systemProduct.sku || `#${systemProduct.id}`)} · {systemProduct.name}
                          </div>
                        ) : (
                          <div className={`text-[11px] mt-0.5 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                            Sin coincidencia automática
                          </div>
                        )}
                        {previewForceCreate.has(item.key) ? (
                          <div className={`text-[11px] mt-0.5 ${dk("text-amber-300", "text-amber-700")}`}>
                            Alta forzada: se cargara como producto nuevo
                          </div>
                        ) : null}
                      </td>
                      <td className={`py-2 ${dk("text-gray-400", "text-[#737373]")}`}>{item.brand}</td>
                      <td className={`py-2 text-right font-mono ${dk("text-gray-300", "text-[#525252]")}`}>
                        {item.cost.toLocaleString("es-AR")}
                      </td>
                      <td className={`py-2 text-right font-mono ${dk("text-gray-300", "text-[#525252]")}`}>
                        {systemUsd !== null ? `$ ${formatUsd(systemUsd)}` : "No cargado"}
                      </td>
                      <td className={`py-2 text-right font-mono ${
                        deltaPct === null
                          ? dk("text-gray-500", "text-[#a3a3a3]")
                          : deltaPct <= 0
                            ? "text-emerald-500"
                            : "text-amber-500"
                      }`}>
                        {deltaPct === null
                          ? (providerUsd === null ? "Sin FX" : "N/A")
                          : `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`}
                      </td>
                      <td className="py-2 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${item.currency === "USD" ? "text-blue-400 border-blue-400/30 bg-blue-400/10" : "text-green-400 border-green-400/30 bg-green-400/10"}`}>
                          {item.currency}
                        </span>
                      </td>
                      <td className={`py-2 text-right font-mono ${dk("text-gray-300", "text-[#525252]")}`}>
                        {item.stock}
                        {item.stockSecondary ? (
                          <div className={`text-[10px] ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                            {item.stockSecondaryLabel}: {item.stockSecondary}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={`px-5 py-4 border-t flex items-center justify-between ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <div className={`text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                <p>El sync solo afecta los productos seleccionados de esta preview.</p>
                <p className="mt-0.5">Forzar alta crea el producto como nuevo, sin usar match automático.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewSupplier(null)}
                  className={`text-sm px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]", "border-[#dcdcdc] text-[#171717] hover:bg-[#f5f5f5]")}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={syncSelectedPreviewItems}
                  disabled={previewSyncing || previewSelected.size === 0}
                  className="text-sm px-4 py-2 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition disabled:opacity-40"
                >
                  {previewSyncing ? "Sincronizando..." : `Sincronizar seleccionados (${previewSelected.size})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SupplierCardProps {
  name: string;
  detail: string;
  color: "green" | "blue";
  progress: {
    phase: string;
    fetched: number;
    processed?: number;
    total?: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
    durationSeconds?: number;
  };
  lastSync: {
    type: string;
    finishedAt: string;
    inserted: number;
    updated: number;
    errors: number;
  } | null;
  running: boolean;
  onFullSync: () => Promise<void>;
  onDeltaSync: () => Promise<void>;
  onPreview: () => Promise<void>;
  fullLabel: string;
  fullHelp: string;
  deltaLabel: string;
  deltaHelp: string;
  previewLabel: string;
  previewHelp: string;
  isDark?: boolean;
}

function SupplierCard({
  name,
  detail,
  color,
  progress,
  lastSync,
  running,
  onFullSync,
  onDeltaSync,
  onPreview,
  fullLabel,
  fullHelp,
  deltaLabel,
  deltaHelp,
  previewLabel,
  previewHelp,
  isDark = true,
}: SupplierCardProps) {
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const card = `border rounded-xl p-6 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`;
  const accent = color === "green" ? "text-[#2D9F6A]" : "text-blue-400";
  const accentBg = color === "green" ? "bg-[#2D9F6A]/10 border-[#2D9F6A]/20" : "bg-blue-500/10 border-blue-500/20";
  const buttonPrimary = color === "green"
    ? "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
    : "bg-blue-600 hover:bg-blue-700 text-white";

  const isIdle = progress.phase === "idle";
  const isError = progress.phase === "error";
  const isDone = progress.phase === "done";

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-lg border ${accentBg} flex items-center justify-center shrink-0`}>
            <Wifi size={16} className={accent} />
          </div>
          <div>
            <p className={`font-semibold text-sm ${dk("text-white", "text-[#171717]")}`}>{name}</p>
            <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>{detail}</p>
          </div>
        </div>
        {lastSync && (
          <div className={`text-right text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
            <p>{lastSync.type === "catalog" ? "Catalogo" : "Incremental"}</p>
            <p>{new Date(lastSync.finishedAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</p>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <div className={`rounded-xl border p-2.5 ${dk("border-[#1f1f1f] bg-[#0f0f0f]", "border-[#e9e9e9] bg-[#fcfcfc]")}`}>
          <button
            onClick={() => { void onFullSync(); }}
            disabled={running}
            className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition disabled:opacity-40 ${buttonPrimary}`}
          >
            <Download size={14} />
            {running ? "Sincronizando..." : fullLabel}
          </button>
          <p className={`mt-2 px-1 text-[11px] leading-relaxed ${dk("text-gray-500", "text-[#737373]")}`}>
            ({fullHelp})
          </p>
        </div>
        <div className={`rounded-xl border p-2.5 ${dk("border-[#1f1f1f] bg-[#0f0f0f]", "border-[#e9e9e9] bg-[#fcfcfc]")}`}>
          <button
            onClick={() => { void onDeltaSync(); }}
            disabled={running}
            className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition disabled:opacity-40 ${dk("border border-[#2a2a2a] bg-[#171717] text-gray-300 hover:bg-[#1e1e1e]", "border border-[#dcdcdc] bg-white text-[#171717] hover:bg-[#f5f5f5]")}`}
          >
            <Zap size={14} />
            {running ? "Sincronizando..." : deltaLabel}
          </button>
          <p className={`mt-2 px-1 text-[11px] leading-relaxed ${dk("text-gray-500", "text-[#737373]")}`}>
            ({deltaHelp})
          </p>
        </div>
        <div className={`rounded-xl border p-2.5 ${dk("border-[#1f1f1f] bg-[#0f0f0f]", "border-[#e9e9e9] bg-[#fcfcfc]")}`}>
          <button
            onClick={() => { void onPreview(); }}
            disabled={running}
            className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition disabled:opacity-40 ${dk("border border-[#2a2a2a] bg-[#171717] text-gray-300 hover:bg-[#1e1e1e]", "border border-[#dcdcdc] bg-white text-[#171717] hover:bg-[#f5f5f5]")}`}
          >
            <Eye size={14} />
            {previewLabel}
          </button>
          <p className={`mt-2 px-1 text-[11px] leading-relaxed ${dk("text-gray-500", "text-[#737373]")}`}>
            ({previewHelp})
          </p>
        </div>
      </div>

      {!isIdle && (
        <div className={`rounded-xl border p-4 ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#efefef] bg-[#fafafa]")}`}>
          <div className="flex items-center gap-2 mb-3">
            {isError ? (
              <AlertTriangle size={15} className="text-red-400" />
            ) : isDone ? (
              <CheckCircle2 size={15} className="text-[#2D9F6A]" />
            ) : (
              <RefreshCw size={15} className={`${accent} animate-spin`} />
            )}
            <span className={`text-sm font-semibold ${isError ? "text-red-400" : accent}`}>
              {PHASE_LABELS[progress.phase] ?? progress.phase}
            </span>
            {progress.durationSeconds !== undefined && (
              <span className={`ml-auto text-xs flex items-center gap-1 ${dk("text-gray-500", "text-[#737373]")}`}>
                <Clock size={11} /> {progress.durationSeconds}s
              </span>
            )}
          </div>

          {progress.phase === "upserting" && (progress.total ?? 0) > 0 && (
            <p className={`text-[11px] mb-2 ${dk("text-gray-500", "text-[#737373]")}`}>
              Procesados: {(progress.processed ?? 0).toLocaleString("es-AR")} / {(progress.total ?? 0).toLocaleString("es-AR")}
            </p>
          )}

          <div className="grid grid-cols-4 gap-2">
            <Metric label="Descargados" value={progress.fetched} isDark={isDark} />
            <Metric label="Nuevos" value={progress.inserted} color="text-[#2D9F6A]" isDark={isDark} />
            <Metric label="Actualizados" value={progress.updated} color="text-blue-400" isDark={isDark} />
            <Metric label="Errores" value={progress.errors.length} color={progress.errors.length ? "text-red-400" : undefined} isDark={isDark} />
          </div>

          {progress.errors.length > 0 && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs space-y-1 ${dk("bg-red-500/8 text-red-400", "bg-red-50 text-red-600")}`}>
              {progress.errors.slice(0, 5).map((error, index) => (
                <p key={index}>• {error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  isDark = true,
}: {
  label: string;
  value: number;
  color?: string;
  isDark?: boolean;
}) {
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  return (
    <div className={`rounded-lg px-3 py-2.5 ${dk("bg-[#111]", "bg-white")}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-0.5 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
        {label}
      </p>
      <p className={`text-lg font-extrabold tabular-nums ${color ?? dk("text-white", "text-[#171717]")}`}>
        {value.toLocaleString("es-AR")}
      </p>
    </div>
  );
}
