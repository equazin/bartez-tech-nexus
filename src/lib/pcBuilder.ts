import { getAvailableStock } from "@/lib/pricing";
import type { Product } from "@/models/products";
import type {
  BuildCompatibilityResult,
  BuilderGoal,
  BuilderPriority,
  BuilderSlotKey,
  CandidateCompatibility,
  SelectedBuilderItem,
  SelectedBuilderItems,
} from "@/models/pcBuilder";
import { BUILDER_REQUIRED_SLOTS, BUILDER_SLOT_CONFIG } from "@/models/pcBuilder";

const SLOT_KEYWORDS: Record<BuilderSlotKey, string[]> = {
  cpu: [
    "cpu",
    "procesador",
    "microprocesador",
    "ryzen",
    "threadripper",
    "athlon",
    "xeon",
    "celeron",
    "pentium",
    "intel core",
    "core i3",
    "core i5",
    "core i7",
    "core i9",
    "core ultra",
  ],
  motherboard: ["motherboard", "mainboard", "placa madre", "mobo"],
  ram: ["ram", "memoria", "memory", "ddr4", "ddr5", "ddr3", "udimm", "sodimm", "so-dimm"],
  storage: ["ssd", "hdd", "nvme", "m.2", "sata", "disco rigido", "solid state", "unidad de estado solido"],
  gpu: ["gpu", "placa de video", "video card", "graphics card", "rtx", "gtx", "radeon", "geforce", "quadro", "intel arc"],
  psu: ["fuente", "psu", "power supply", "fuente de alimentacion", "80 plus", "modular", "bronze", "gold", "platinum"],
  case: ["gabinete", "pc case", "computer case", "chassis", "mid tower", "full tower", "mini tower"],
  monitor: ["monitor", "display", "pantalla", "ips", "oled", "va", "fhd", "qhd", "uhd", "4k", "144hz", "165hz"],
};

const SLOT_CATEGORY_HINTS: Record<BuilderSlotKey, string[]> = {
  cpu: ["procesador", "procesadores", "cpu", "microprocesador", "microprocesadores"],
  motherboard: ["motherboard", "motherboards", "placa madre", "placas madre", "mainboard"],
  ram: ["memoria", "memorias", "ram", "memory"],
  storage: ["almacenamiento", "storage", "ssd", "hdd", "discos"],
  gpu: ["gpu", "placa de video", "placas de video", "video", "graphics"],
  psu: ["fuente", "fuentes", "psu", "power supply"],
  case: ["gabinete", "gabinetes", "case", "cases", "chassis"],
  monitor: ["monitor", "monitores", "display", "pantalla", "pantallas"],
};

const GENERIC_NON_PC_KEYWORDS = [
  "camara",
  "camera",
  "cctv",
  "alarma",
  "detector",
  "sensor",
  "router",
  "switch",
  "access point",
  "punto de acceso",
  "cpe",
  "baby monitor",
  "dvr",
  "nvr",
  "grabador",
  "auricular",
  "headset",
  "microfono",
  "teclado",
  "keyboard",
  "mouse",
  "impresora",
  "printer",
  "telefono",
  "tablet",
  "notebook",
  "laptop",
  "mini pc",
  "barebone",
  "all in one",
  "aio",
  "terminal pos",
  "touch pos",
  "servidor",
  "server",
  "firewall",
];

const PREBUILT_PC_KEYWORDS = [
  "pc ",
  "pc+",
  "pc cx",
  "pc performance",
  "pc gamer",
  "equipo armado",
  "equipo completo",
  "desktop pc",
  "mini pc",
  "barebone",
  "all in one",
  "aio",
  "+ssd",
  "+8g",
  "+16g",
  "+32g",
];

const SLOT_NEGATIVE_KEYWORDS: Record<BuilderSlotKey, string[]> = {
  cpu: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "cooler", "disipador", "refrigeracion", "watercooling", "fan", "ventilador"],
  motherboard: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "cooler", "disipador", "backplate"],
  ram: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "motherboard", "placa madre", "monitor", "gpu", "placa de video", "ssd", "hdd"],
  storage: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "nas", "externo", "external", "pendrive", "flash drive", "usb", "micro sd", "microsd", "sd card", "lector"],
  gpu: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "motherboard", "placa madre", "monitor", "cooler", "disipador"],
  psu: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "ups", "estabilizador", "cargador", "adaptador", "power bank", "bateria", "battery", "inversor"],
  case: [...GENERIC_NON_PC_KEYWORDS, ...PREBUILT_PC_KEYWORDS, "nas", "rack", "server", "servidor", "enclosure", "funda", "cover"],
  monitor: [...GENERIC_NON_PC_KEYWORDS, "baby monitor", "monitoring", "vigilancia", "surveillance", "camara", "camera", "dvr", "nvr"],
};

const DEFAULT_CPU_WATTS_BY_GOAL: Record<BuilderGoal, number> = {
  office: 65,
  gaming: 95,
  workstation: 125,
};

const DEFAULT_GPU_WATTS_BY_GOAL: Record<BuilderGoal, number> = {
  office: 70,
  gaming: 220,
  workstation: 250,
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function productTextBag(product: Product): string {
  const specText = Object.entries(product.specs ?? {})
    .map(([key, value]) => `${key} ${String(value ?? "")}`)
    .join(" ");

  return normalize(
    [
      product.name,
      product.category,
      product.description,
      product.sku,
      product.brand_name,
      (product.tags ?? []).join(" "),
      specText,
    ].join(" "),
  );
}

function productPrimaryBag(product: Product): string {
  return normalize(
    [
      product.name,
      product.category,
      product.brand_name,
      product.sku,
      (product.tags ?? []).join(" "),
    ].join(" "),
  );
}

function productDetailsBag(product: Product): string {
  return normalize([product.description, product.description_short, product.description_full].join(" "));
}

function productSpecsBag(product: Product): string {
  return normalize(
    Object.entries(product.specs ?? {})
      .map(([key, value]) => `${key} ${String(value ?? "")}`)
      .join(" "),
  );
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function countKeywordMatches(text: string, keywords: string[]): number {
  return keywords.reduce((count, keyword) => (text.includes(normalize(keyword)) ? count + 1 : count), 0);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "")
    .replace(",", ".")
    .match(/-?\d+(\.\d+)?/);
  if (!cleaned) return null;
  const parsed = Number(cleaned[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerNearToken(value: string, token: string): number | null {
  const regex = new RegExp(`(\\d{2,4})\\s*${token}`, "i");
  const match = value.match(regex);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSpecValue(product: Product, keys: string[]): string | null {
  const specs = product.specs as Record<string, unknown> | undefined;
  if (!specs) return null;
  const entries = Object.entries(specs);
  for (const key of keys) {
    const exact = entries.find(([entryKey]) => normalize(entryKey) === normalize(key));
    if (exact && exact[1] != null && String(exact[1]).trim().length > 0) {
      return String(exact[1]).trim();
    }
  }

  for (const key of keys) {
    const partial = entries.find(([entryKey]) => normalize(entryKey).includes(normalize(key)));
    if (partial && partial[1] != null && String(partial[1]).trim().length > 0) {
      return String(partial[1]).trim();
    }
  }

  return null;
}

function normalizeSocket(value: string | null): string | null {
  if (!value) return null;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length > 0 ? compact : null;
}

function parseSocket(product: Product): string | null {
  const fromSpec = getSpecValue(product, ["socket", "cpu_socket", "supported_socket"]);
  if (fromSpec) return normalizeSocket(fromSpec);

  const text = productTextBag(product).toUpperCase();
  const match = text.match(/\b(AM[34-6]|LGA\s?\d{3,4}|TR4|STRX4|FM2)\b/i);
  return normalizeSocket(match?.[0] ?? null);
}

function parseRamType(product: Product): string | null {
  const fromSpec = getSpecValue(product, ["ram_type", "memory_type", "type_ram", "ddr"]);
  const source = fromSpec ?? `${product.name} ${product.description} ${getSpecValue(product, ["memory", "ram"]) ?? ""}`;
  const match = normalize(source).match(/ddr\s?([3-6])/i);
  if (!match) return null;
  return `DDR${match[1]}`;
}

function canonicalFormFactor(value: string): string {
  const raw = normalize(value).replace(/\s+/g, "");
  if (raw.includes("eatx") || raw.includes("e-atx")) return "e-atx";
  if (raw.includes("microatx") || raw.includes("matx") || raw.includes("m-atx")) return "micro-atx";
  if (raw.includes("miniitx") || raw.includes("mitx")) return "mini-itx";
  if (raw.includes("atx")) return "atx";
  if (raw.includes("itx")) return "mini-itx";
  return raw;
}

function parseMotherboardFormFactor(product: Product): string | null {
  const fromSpec = getSpecValue(product, ["form_factor", "motherboard_form_factor", "mb_form_factor"]);
  const source = fromSpec ?? `${product.name} ${product.description}`;
  const tokens = normalize(source).split(/[^a-z0-9-]+/).filter(Boolean);
  const picked = tokens.find((token) => {
    const canonical = canonicalFormFactor(token);
    return ["atx", "micro-atx", "mini-itx", "e-atx"].includes(canonical);
  });
  return picked ? canonicalFormFactor(picked) : null;
}

function parseCaseSupportedFormFactors(product: Product): string[] {
  const fromSpec =
    getSpecValue(product, ["form_factor", "supported_form_factors", "motherboard_support", "mb_support"]) ??
    `${product.name} ${product.description}`;

  const chunks = normalize(fromSpec)
    .split(/[,/;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const tokens = chunks.length > 0 ? chunks : normalize(fromSpec).split(/\s+/).filter(Boolean);
  const found = new Set<string>();
  for (const token of tokens) {
    const canonical = canonicalFormFactor(token);
    if (["atx", "micro-atx", "mini-itx", "e-atx"].includes(canonical)) {
      found.add(canonical);
    }
  }
  return Array.from(found);
}

const PC_BUILD_DISCOUNT_TIERS: Record<"ARS" | "USD", Array<{ minTotal: number; percentage: number; label: string }>> = {
  ARS: [
    { minTotal: 3_800_000, percentage: 5, label: "Descuento flagship" },
    { minTotal: 2_200_000, percentage: 4, label: "Descuento pro" },
    { minTotal: 1_200_000, percentage: 3, label: "Descuento armado" },
    { minTotal: 1, percentage: 2, label: "Descuento inicial" },
  ],
  USD: [
    { minTotal: 3_800, percentage: 5, label: "Descuento flagship" },
    { minTotal: 2_200, percentage: 4, label: "Descuento pro" },
    { minTotal: 1_200, percentage: 3, label: "Descuento armado" },
    { minTotal: 1, percentage: 2, label: "Descuento inicial" },
  ],
};

export interface PcBuildDiscountDetails {
  percentage: number;
  amount: number;
  label: string;
}

export interface PcBuildCartBundleItem {
  productId: number;
  quantity: number;
  slotKey: BuilderSlotKey;
}

export interface PcBuildCartMeta {
  source: "pc_builder";
  build_id?: string;
  discount_pct: number;
  bundle_items: PcBuildCartBundleItem[];
  updated_at: string;
}

export interface PcBuildCartDiscountLine {
  productId: number;
  quantity: number;
  totalWithIVA: number;
}

export interface PcBuildCartDiscountResult {
  eligible: boolean;
  percentage: number;
  amount: number;
  buildId?: string;
  matchedItems: number;
}

export function parsePsuWattage(product: Product): number | null {
  const raw =
    getSpecValue(product, ["wattage", "power_w", "psu_wattage", "potencia", "max_power"]) ??
    `${product.name} ${product.description}`;
  const explicit = parseIntegerNearToken(raw, "w");
  if (explicit) return explicit;
  const generic = parseNumber(raw);
  if (!generic) return null;
  return generic >= 100 ? Math.round(generic) : null;
}

function parseCpuTdp(product: Product): number | null {
  const raw = getSpecValue(product, ["tdp", "power_w", "cpu_power", "wattage"]) ?? `${product.name} ${product.description}`;
  const parsed = parseIntegerNearToken(raw, "w") ?? parseNumber(raw);
  if (!parsed) return null;
  return parsed >= 20 && parsed <= 450 ? Math.round(parsed) : null;
}

function parseGpuTdp(product: Product): number | null {
  const raw =
    getSpecValue(product, ["tdp", "power_w", "gpu_power", "board_power", "recommended_psu"]) ??
    `${product.name} ${product.description}`;
  const parsed = parseIntegerNearToken(raw, "w") ?? parseNumber(raw);
  if (!parsed) return null;
  return parsed >= 30 && parsed <= 700 ? Math.round(parsed) : null;
}

function parseGpuLengthMm(product: Product): number | null {
  const raw = getSpecValue(product, ["length_mm", "gpu_length_mm", "length", "card_length"]) ?? `${product.name} ${product.description}`;
  const mm = parseIntegerNearToken(raw, "mm") ?? parseNumber(raw);
  if (!mm) return null;
  return mm >= 100 && mm <= 500 ? Math.round(mm) : null;
}

function parseCaseMaxGpuLengthMm(product: Product): number | null {
  const raw =
    getSpecValue(product, ["max_gpu_length_mm", "gpu_max_length_mm", "max_gpu_length", "gpu_clearance"]) ??
    `${product.name} ${product.description}`;
  const mm = parseIntegerNearToken(raw, "mm") ?? parseNumber(raw);
  if (!mm) return null;
  return mm >= 100 && mm <= 600 ? Math.round(mm) : null;
}

function parseMonitorSizeInches(product: Product): number | null {
  const raw =
    getSpecValue(product, ["screen_size", "screen", "size", "display_size", "diagonal"]) ??
    `${product.name} ${product.description}`;
  const match = normalize(raw).match(/\b(\d{2})(?:[.,]\d)?\s*(?:"|pulg|inch|in)\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreProductForBuilderSlot(product: Product, slotKey: BuilderSlotKey): number {
  const primary = productPrimaryBag(product);
  const details = productDetailsBag(product);
  const specs = productSpecsBag(product);
  const fullBag = `${primary} ${details} ${specs}`;
  const category = normalize(product.category);
  const categoryHits = countKeywordMatches(category, SLOT_CATEGORY_HINTS[slotKey]);
  const primaryHits = countKeywordMatches(primary, SLOT_KEYWORDS[slotKey]);
  const detailHits = countKeywordMatches(`${details} ${specs}`, SLOT_KEYWORDS[slotKey]);

  if (includesAny(primary, SLOT_NEGATIVE_KEYWORDS[slotKey])) return 0;

  switch (slotKey) {
    case "cpu": {
      if (primaryHits === 0) return 0;
      return primaryHits * 10 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + (parseCpuTdp(product) ? 2 : 0);
    }
    case "motherboard": {
      const structured = parseSocket(product) && parseMotherboardFormFactor(product);
      if (primaryHits === 0 && !(categoryHits > 0 && structured)) return 0;
      return primaryHits * 10 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + (structured ? 4 : 0);
    }
    case "ram": {
      const ramType = parseRamType(product);
      if (primaryHits === 0 && !ramType && categoryHits === 0) return 0;
      return primaryHits * 9 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + (ramType ? 4 : 0);
    }
    case "storage": {
      const storageSignal = includesAny(`${primary} ${details} ${specs}`, ["ssd", "hdd", "nvme", "m.2", "sata", "pcie 4.0", "pcie 5.0"]);
      if (primaryHits === 0 && !storageSignal) return 0;
      return primaryHits * 10 + detailHits * 2 + (storageSignal ? 4 : 0) + (categoryHits > 0 ? 2 : 0);
    }
    case "gpu": {
      const vramSignal = includesAny(`${details} ${specs}`, ["gddr5", "gddr6", "gddr6x", "vram", "cuda", "stream processors"]);
      if (primaryHits === 0) return 0;
      return primaryHits * 10 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + (vramSignal ? 3 : 0);
    }
    case "psu": {
      const wattage = parsePsuWattage(product);
      if (primaryHits === 0 || !wattage) return 0;
      return primaryHits * 9 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + Math.min(6, Math.floor(wattage / 150));
    }
    case "case": {
      const supportedFormFactors = parseCaseSupportedFormFactors(product).length;
      if (primaryHits === 0 && !(categoryHits > 0 && supportedFormFactors > 0)) return 0;
      return primaryHits * 9 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + Math.min(4, supportedFormFactors);
    }
    case "monitor": {
      const displaySignal = includesAny(`${details} ${specs}`, ["hz", "ips", "oled", "va", "fhd", "qhd", "uhd", "4k", "1080p", "1440p"]);
      const sizeInches = parseMonitorSizeInches(product);
      if (primaryHits === 0 && !(categoryHits > 0 && (displaySignal || sizeInches))) return 0;
      return primaryHits * 9 + detailHits * 2 + (categoryHits > 0 ? 4 : 0) + (displaySignal ? 4 : 0) + (sizeInches ? 3 : 0);
    }
    default:
      return 0;
  }
}

function estimateBuildPowerW(selection: SelectedBuilderItems, goal: BuilderGoal): number {
  const cpuPower = selection.cpu ? parseCpuTdp(selection.cpu.product) ?? DEFAULT_CPU_WATTS_BY_GOAL[goal] : 0;
  const gpuPower = selection.gpu ? parseGpuTdp(selection.gpu.product) ?? DEFAULT_GPU_WATTS_BY_GOAL[goal] : 0;
  const motherboardPower = selection.motherboard ? 45 : 0;
  const ramPower = selection.ram ? 12 : 0;
  const storagePower = selection.storage ? 10 : 0;
  const monitorPower = selection.monitor ? 35 : 0;
  const baseOverhead = 45;
  return Math.max(0, cpuPower + gpuPower + motherboardPower + ramPower + storagePower + monitorPower + baseOverhead);
}

function recommendedPsuW(estimatedW: number): number {
  const withMargin = estimatedW * 1.25;
  return Math.max(450, Math.ceil(withMargin / 50) * 50);
}

export function getPcBuildDiscount(total: number, currency: "ARS" | "USD"): PcBuildDiscountDetails {
  if (total <= 0) {
    return { percentage: 0, amount: 0, label: "Descuento armado" };
  }
  const tiers = PC_BUILD_DISCOUNT_TIERS[currency];
  const matchedTier = tiers.find((tier) => total >= tier.minTotal) ?? tiers[tiers.length - 1];
  const percentage = matchedTier?.percentage ?? 0;
  const amount = Number(((Math.max(0, total) * percentage) / 100).toFixed(2));
  return {
    percentage,
    amount,
    label: matchedTier?.label ?? "Descuento armado",
  };
}

export function applyTotalDiscount(
  subtotal: number,
  ivaTotal: number,
  discountAmount: number,
): { subtotal: number; ivaTotal: number; total: number } {
  const safeSubtotal = Math.max(0, subtotal);
  const safeIvaTotal = Math.max(0, ivaTotal);
  const baseTotal = safeSubtotal + safeIvaTotal;
  const safeDiscount = Math.max(0, Math.min(discountAmount, baseTotal));

  if (baseTotal <= 0 || safeDiscount <= 0) {
    return {
      subtotal: Number(safeSubtotal.toFixed(2)),
      ivaTotal: Number(safeIvaTotal.toFixed(2)),
      total: Number(baseTotal.toFixed(2)),
    };
  }

  const factor = (baseTotal - safeDiscount) / baseTotal;
  const discountedSubtotal = Number((safeSubtotal * factor).toFixed(2));
  const discountedIva = Number((safeIvaTotal * factor).toFixed(2));

  return {
    subtotal: discountedSubtotal,
    ivaTotal: discountedIva,
    total: Number((discountedSubtotal + discountedIva).toFixed(2)),
  };
}

export function getPcBuildCartDiscount(
  meta: PcBuildCartMeta | null | undefined,
  cartLines: PcBuildCartDiscountLine[],
): PcBuildCartDiscountResult {
  if (!meta || meta.source !== "pc_builder" || meta.bundle_items.length === 0 || meta.discount_pct <= 0) {
    return { eligible: false, percentage: 0, amount: 0, matchedItems: 0 };
  }

  let eligibleTotal = 0;
  let matchedItems = 0;

  for (const bundleItem of meta.bundle_items) {
    const cartLine = cartLines.find((line) => line.productId === bundleItem.productId);
    if (!cartLine || cartLine.quantity < bundleItem.quantity || cartLine.quantity <= 0) {
      return { eligible: false, percentage: meta.discount_pct, amount: 0, buildId: meta.build_id, matchedItems: 0 };
    }

    const perUnitTotal = cartLine.totalWithIVA / cartLine.quantity;
    eligibleTotal += perUnitTotal * bundleItem.quantity;
    matchedItems += 1;
  }

  return {
    eligible: matchedItems === meta.bundle_items.length,
    percentage: meta.discount_pct,
    amount: Number(((eligibleTotal * meta.discount_pct) / 100).toFixed(2)),
    buildId: meta.build_id,
    matchedItems,
  };
}

export function getBuilderSlotLabel(slotKey: BuilderSlotKey): string {
  return BUILDER_SLOT_CONFIG.find((slot) => slot.key === slotKey)?.label ?? slotKey;
}

export function productMatchesBuilderSlot(product: Product, slotKey: BuilderSlotKey): boolean {
  return scoreProductForBuilderSlot(product, slotKey) > 0;
}

export function buildSlotCandidates(products: Product[]): Record<BuilderSlotKey, Product[]> {
  const bySlot: Record<BuilderSlotKey, Product[]> = {
    cpu: [],
    motherboard: [],
    ram: [],
    storage: [],
    gpu: [],
    psu: [],
    case: [],
    monitor: [],
  };

  for (const product of products) {
    for (const slot of BUILDER_SLOT_CONFIG) {
      if (productMatchesBuilderSlot(product, slot.key)) {
        bySlot[slot.key].push(product);
      }
    }
  }

  for (const slot of BUILDER_SLOT_CONFIG) {
    bySlot[slot.key].sort((a, b) => {
      const relevanceDiff = scoreProductForBuilderSlot(b, slot.key) - scoreProductForBuilderSlot(a, slot.key);
      if (relevanceDiff !== 0) return relevanceDiff;
      const stockDiff = getAvailableStock(b) - getAvailableStock(a);
      if (stockDiff !== 0) return stockDiff;
      return a.name.localeCompare(b.name, "es");
    });
  }

  return bySlot;
}

export function evaluateBuildCompatibility(selection: SelectedBuilderItems, goal: BuilderGoal): BuildCompatibilityResult {
  const issues: BuildCompatibilityResult["issues"] = [];
  const missingRequiredSlots = BUILDER_REQUIRED_SLOTS.filter((slot) => !selection[slot]);

  for (const slot of missingRequiredSlots) {
    issues.push({
      id: `missing_slot_${slot}`,
      severity: "error",
      title: `Falta ${getBuilderSlotLabel(slot)}`,
      description: `El slot ${getBuilderSlotLabel(slot)} es obligatorio para cerrar el armado.`,
      action: `Seleccioná un componente en ${getBuilderSlotLabel(slot)}.`,
      slotKeys: [slot],
    });
  }

  if (selection.cpu && selection.motherboard) {
    const cpuSocket = parseSocket(selection.cpu.product);
    const mbSocket = parseSocket(selection.motherboard.product);
    if (!cpuSocket || !mbSocket) {
      issues.push({
        id: "incomplete_cpu_motherboard_socket",
        severity: "error",
        title: "Dato técnico faltante (socket)",
        description: "No se pudo validar socket entre CPU y motherboard por datos incompletos.",
        action: "Elegí modelos con socket explícito o cambiá uno de los componentes.",
        slotKeys: ["cpu", "motherboard"],
      });
    } else if (cpuSocket !== mbSocket) {
      issues.push({
        id: "incompatible_cpu_motherboard_socket",
        severity: "error",
        title: "CPU y motherboard incompatibles",
        description: `Socket CPU ${cpuSocket} no coincide con socket motherboard ${mbSocket}.`,
        action: "Cambiá CPU o motherboard por un modelo con socket compatible.",
        slotKeys: ["cpu", "motherboard"],
      });
    }
  }

  if (selection.ram && selection.motherboard) {
    const ramType = parseRamType(selection.ram.product);
    const motherboardRamType = parseRamType(selection.motherboard.product);
    if (!ramType || !motherboardRamType) {
      issues.push({
        id: "incomplete_ram_motherboard_type",
        severity: "error",
        title: "Dato técnico faltante (tipo de RAM)",
        description: "No se pudo validar el tipo de RAM por información incompleta.",
        action: "Usá RAM y motherboard con DDR explícito (DDR4/DDR5).",
        slotKeys: ["ram", "motherboard"],
      });
    } else if (ramType !== motherboardRamType) {
      issues.push({
        id: "incompatible_ram_motherboard_type",
        severity: "error",
        title: "RAM incompatible con motherboard",
        description: `${ramType} no coincide con el tipo soportado por la motherboard (${motherboardRamType}).`,
        action: "Cambiá la RAM o la motherboard.",
        slotKeys: ["ram", "motherboard"],
      });
    }
  }

  const estimatedPowerW = estimateBuildPowerW(selection, goal);
  const recommendedPsu = recommendedPsuW(estimatedPowerW);
  if (selection.psu) {
    const psuW = parsePsuWattage(selection.psu.product);
    if (!psuW) {
      issues.push({
        id: "incomplete_psu_wattage",
        severity: "error",
        title: "Dato técnico faltante (PSU)",
        description: "La fuente seleccionada no informa wattage usable para validación.",
        action: "Elegí una fuente con potencia explícita (ej: 650W).",
        slotKeys: ["psu"],
      });
    } else if (psuW < recommendedPsu) {
      issues.push({
        id: "incompatible_psu_power",
        severity: "error",
        title: "PSU insuficiente",
        description: `La fuente (${psuW}W) no alcanza la recomendación (${recommendedPsu}W).`,
        action: "Subí la fuente a una potencia mayor.",
        slotKeys: ["psu", "cpu", "gpu"],
      });
    }
  }

  if (selection.motherboard && selection.case) {
    const boardFormFactor = parseMotherboardFormFactor(selection.motherboard.product);
    const caseSupport = parseCaseSupportedFormFactors(selection.case.product);
    if (!boardFormFactor || caseSupport.length === 0) {
      issues.push({
        id: "incomplete_case_motherboard_form_factor",
        severity: "error",
        title: "Dato técnico faltante (form factor)",
        description: "No se pudo validar compatibilidad de formato entre motherboard y gabinete.",
        action: "Seleccioná componentes con form factor explícito (ATX/mATX/ITX).",
        slotKeys: ["motherboard", "case"],
      });
    } else if (!caseSupport.includes(boardFormFactor)) {
      issues.push({
        id: "incompatible_case_motherboard_form_factor",
        severity: "error",
        title: "Gabinete incompatible con motherboard",
        description: `El gabinete no soporta motherboard ${boardFormFactor.toUpperCase()}.`,
        action: "Cambiá gabinete o motherboard por form factor compatible.",
        slotKeys: ["motherboard", "case"],
      });
    }
  }

  if (selection.gpu && selection.case) {
    const gpuLength = parseGpuLengthMm(selection.gpu.product);
    const caseMaxGpuLength = parseCaseMaxGpuLengthMm(selection.case.product);
    if (gpuLength && caseMaxGpuLength) {
      if (gpuLength > caseMaxGpuLength) {
        issues.push({
          id: "incompatible_gpu_case_length",
          severity: "error",
          title: "GPU demasiado larga para el gabinete",
          description: `La GPU (${gpuLength}mm) supera el máximo del gabinete (${caseMaxGpuLength}mm).`,
          action: "Cambiá GPU o gabinete.",
          slotKeys: ["gpu", "case"],
        });
      }
    } else {
      issues.push({
        id: "warn_gpu_case_length_unknown",
        severity: "warning",
        title: "Longitud GPU sin validar",
        description: "Falta dato de largo GPU o máximo de gabinete. Revisá manualmente antes de cerrar.",
        action: "Confirmá el largo permitido del gabinete.",
        slotKeys: ["gpu", "case"],
      });
    }
  }

  if (!selection.gpu && (goal === "gaming" || goal === "workstation")) {
    issues.push({
      id: "warn_goal_without_gpu",
      severity: "warning",
      title: "GPU recomendada",
      description: `Para objetivo ${goal === "gaming" ? "Gaming" : "Workstation"} conviene incluir GPU dedicada.`,
      action: "Podés seguir sin GPU, pero el rendimiento puede quedar corto.",
      slotKeys: ["gpu"],
    });
  }

  const hasHardIncompatibility = issues.some(
    (issue) => issue.severity === "error" && !issue.id.startsWith("missing_") && !issue.id.startsWith("incomplete_"),
  );
  const hasIncompleteErrors = issues.some(
    (issue) => issue.severity === "error" && (issue.id.startsWith("missing_") || issue.id.startsWith("incomplete_")),
  );

  const state = hasHardIncompatibility ? "incompatible" : hasIncompleteErrors ? "incomplete" : "compatible";
  const canFinalize = !issues.some((issue) => issue.severity === "error");

  return {
    state,
    canFinalize,
    issues,
    missingRequiredSlots,
    estimatedPowerW,
    recommendedPsuW: recommendedPsu,
  };
}

export function assessCandidateCompatibility(
  slotKey: BuilderSlotKey,
  product: Product,
  currentSelection: SelectedBuilderItems,
  goal: BuilderGoal,
): CandidateCompatibility {
  if (getAvailableStock(product) <= 0) {
    return { state: "incompatible", reason: "Sin stock disponible." };
  }

  const nextSelection: SelectedBuilderItems = {
    ...currentSelection,
    [slotKey]: {
      product,
      quantity: currentSelection[slotKey]?.quantity ?? 1,
    } as SelectedBuilderItem,
  };

  const compatibility = evaluateBuildCompatibility(nextSelection, goal);
  const slotIssues = compatibility.issues.filter((issue) => issue.slotKeys.includes(slotKey));
  const blockingIssue = slotIssues.find((issue) => issue.severity === "error");
  if (blockingIssue) {
    const state = blockingIssue.id.startsWith("missing_") || blockingIssue.id.startsWith("incomplete_")
      ? "incomplete"
      : "incompatible";
    return { state, reason: blockingIssue.description };
  }

  const warning = slotIssues.find((issue) => issue.severity === "warning");
  if (warning) return { state: "compatible", reason: warning.description };

  return { state: "compatible" };
}

function pickByPriority(candidates: Product[], priority: BuilderPriority): Product | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => (a.cost_price ?? 0) - (b.cost_price ?? 0));

  if (priority === "price") return sorted[0];
  if (priority === "performance") {
    const idx = Math.max(0, Math.floor(sorted.length * 0.75));
    return sorted[Math.min(sorted.length - 1, idx)];
  }

  return sorted[Math.floor(sorted.length / 2)];
}

function buildTotalCost(selection: SelectedBuilderItems): number {
  return Object.values(selection).reduce((sum, item) => {
    if (!item) return sum;
    return sum + (item.product.cost_price ?? 0) * item.quantity;
  }, 0);
}

function replaceWithCheaperOption(
  slotKey: BuilderSlotKey,
  selection: SelectedBuilderItems,
  candidatesBySlot: Record<BuilderSlotKey, Product[]>,
): boolean {
  const current = selection[slotKey];
  if (!current) return false;
  const currentCost = current.product.cost_price ?? 0;
  const cheaper = candidatesBySlot[slotKey]
    .filter((candidate) => (candidate.cost_price ?? 0) < currentCost)
    .sort((a, b) => (a.cost_price ?? 0) - (b.cost_price ?? 0))[0];

  if (!cheaper) return false;
  selection[slotKey] = { product: cheaper, quantity: current.quantity };
  return true;
}

function replaceWithMoreExpensiveOption(
  slotKey: BuilderSlotKey,
  selection: SelectedBuilderItems,
  candidatesBySlot: Record<BuilderSlotKey, Product[]>,
): boolean {
  const current = selection[slotKey];
  if (!current) return false;
  const currentCost = current.product.cost_price ?? 0;
  const expensive = candidatesBySlot[slotKey]
    .filter((candidate) => (candidate.cost_price ?? 0) > currentCost)
    .sort((a, b) => (a.cost_price ?? 0) - (b.cost_price ?? 0))[0];

  if (!expensive) return false;
  selection[slotKey] = { product: expensive, quantity: current.quantity };
  return true;
}

function alignCoreCompatibility(
  selection: SelectedBuilderItems,
  candidatesBySlot: Record<BuilderSlotKey, Product[]>,
  goal: BuilderGoal,
): void {
  if (selection.cpu && selection.motherboard) {
    const cpuSocket = parseSocket(selection.cpu.product);
    const motherboardSocket = parseSocket(selection.motherboard.product);
    if (cpuSocket && motherboardSocket && cpuSocket !== motherboardSocket) {
      const matchingBoard = candidatesBySlot.motherboard.find((board) => parseSocket(board) === cpuSocket);
      if (matchingBoard) selection.motherboard = { product: matchingBoard, quantity: 1 };
    }
  }

  if (selection.ram && selection.motherboard) {
    const boardRamType = parseRamType(selection.motherboard.product);
    const ramType = parseRamType(selection.ram.product);
    if (boardRamType && ramType && boardRamType !== ramType) {
      const matchingRam = candidatesBySlot.ram.find((ram) => parseRamType(ram) === boardRamType);
      if (matchingRam) selection.ram = { product: matchingRam, quantity: 1 };
    }
  }

  if (selection.psu) {
    const estimate = recommendedPsuW(estimateBuildPowerW(selection, goal));
    const currentPsuW = parsePsuWattage(selection.psu.product) ?? 0;
    if (currentPsuW < estimate) {
      const betterPsu = candidatesBySlot.psu.find((psu) => (parsePsuWattage(psu) ?? 0) >= estimate);
      if (betterPsu) selection.psu = { product: betterPsu, quantity: 1 };
    }
  }
}

export function createGuidedBaseSelection(params: {
  candidatesBySlot: Record<BuilderSlotKey, Product[]>;
  goal: BuilderGoal;
  priority: BuilderPriority;
  budgetMin?: number;
  budgetMax?: number;
}): SelectedBuilderItems {
  const { candidatesBySlot, goal, priority, budgetMin, budgetMax } = params;
  const selection: SelectedBuilderItems = {};

  for (const slot of BUILDER_SLOT_CONFIG) {
    if (slot.key === "gpu" && goal === "office") continue;
    const pick = pickByPriority(candidatesBySlot[slot.key], priority);
    if (pick) selection[slot.key] = { product: pick, quantity: 1 };
  }

  alignCoreCompatibility(selection, candidatesBySlot, goal);

  if (budgetMax && budgetMax > 0) {
    let total = buildTotalCost(selection);
    const adjustableSlots: BuilderSlotKey[] = ["gpu", "cpu", "motherboard", "monitor", "psu", "case", "ram", "storage"];
    let guard = 0;
    while (total > budgetMax && guard < 16) {
      let changed = false;
      for (const slotKey of adjustableSlots) {
        if (replaceWithCheaperOption(slotKey, selection, candidatesBySlot)) {
          changed = true;
          break;
        }
      }
      if (!changed) break;
      alignCoreCompatibility(selection, candidatesBySlot, goal);
      total = buildTotalCost(selection);
      guard += 1;
    }
  }

  if (budgetMin && budgetMin > 0 && priority !== "price") {
    let total = buildTotalCost(selection);
    const upgradeSlots: BuilderSlotKey[] = ["gpu", "cpu", "monitor", "motherboard", "ram", "storage", "psu"];
    let guard = 0;
    while (total < budgetMin && guard < 12) {
      let changed = false;
      for (const slotKey of upgradeSlots) {
        if (replaceWithMoreExpensiveOption(slotKey, selection, candidatesBySlot)) {
          changed = true;
          break;
        }
      }
      if (!changed) break;
      alignCoreCompatibility(selection, candidatesBySlot, goal);
      total = buildTotalCost(selection);
      guard += 1;
    }
  }

  return selection;
}
