import type { Product } from "@/models/products";

export type PcComponentType =
  | "cpu"
  | "motherboard"
  | "ram"
  | "gpu"
  | "storage"
  | "storage_secondary"
  | "psu"
  | "case"
  | "cooler"
  | "monitor";

export const PC_COMPONENT_ORDER: PcComponentType[] = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "storage",
  "storage_secondary",
  "psu",
  "case",
  "cooler",
  "monitor",
];

export const PC_REQUIRED_COMPONENTS: PcComponentType[] = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "storage",
  "psu",
  "case",
  "cooler",
];

export const PC_COMPONENT_PREREQUISITES: Partial<Record<PcComponentType, PcComponentType>> = {
  motherboard: "cpu",
  ram: "motherboard",
  gpu: "motherboard",
  storage: "motherboard",
  storage_secondary: "storage",
  psu: "cpu",
  case: "motherboard",
  cooler: "cpu",
};

export const PC_COMPONENT_LABELS: Record<PcComponentType, string> = {
  cpu: "CPU",
  motherboard: "Motherboard",
  ram: "Memoria RAM",
  gpu: "Placa de video",
  storage: "Almacenamiento principal",
  storage_secondary: "Almacenamiento secundario",
  psu: "Fuente",
  case: "Gabinete",
  cooler: "Cooler",
  monitor: "Monitor",
};

export type PcCanonicalSpecKey =
  | "socket"
  | "platform_brand"
  | "memory_type"
  | "form_factor"
  | "wattage"
  | "tdp_w"
  | "socket_supported"
  | "interface"
  | "gpu_length_mm"
  | "case_gpu_max_mm"
  | "ram_speed_mts"
  | "mb_max_ram_speed_mts"
  | "ram_profiles"
  | "mb_ram_profiles"
  | "cpu_generation"
  | "mb_cpu_gen_max"
  | "mb_bios_cpu_gen_ready"
  | "cooler_tdp_w"
  | "cooler_type"
  | "cooler_height_mm"
  | "case_cooler_max_mm"
  | "radiator_size_mm"
  | "case_radiator_max_mm"
  | "gpu_thickness_slots"
  | "case_gpu_max_slots"
  | "mb_m2_slots"
  | "mb_sata_ports"
  | "mb_sata_ports_disabled_with_m2"
  | "mb_pcie_x16_slots";

export const PC_CANONICAL_KEYS: PcCanonicalSpecKey[] = [
  "socket",
  "platform_brand",
  "memory_type",
  "form_factor",
  "wattage",
  "tdp_w",
  "socket_supported",
  "interface",
  "gpu_length_mm",
  "case_gpu_max_mm",
  "ram_speed_mts",
  "mb_max_ram_speed_mts",
  "ram_profiles",
  "mb_ram_profiles",
  "cpu_generation",
  "mb_cpu_gen_max",
  "mb_bios_cpu_gen_ready",
  "cooler_tdp_w",
  "cooler_type",
  "cooler_height_mm",
  "case_cooler_max_mm",
  "radiator_size_mm",
  "case_radiator_max_mm",
  "gpu_thickness_slots",
  "case_gpu_max_slots",
  "mb_m2_slots",
  "mb_sata_ports",
  "mb_sata_ports_disabled_with_m2",
  "mb_pcie_x16_slots",
];

export interface PcSpecsNormalized {
  socket?: string;
  platform_brand?: string;
  memory_type?: string;
  form_factor?: string[];
  wattage?: number;
  tdp_w?: number;
  socket_supported?: string[];
  interface?: string[];
  gpu_length_mm?: number;
  case_gpu_max_mm?: number;
  ram_speed_mts?: number;
  mb_max_ram_speed_mts?: number;
  ram_profiles?: string[];
  mb_ram_profiles?: string[];
  cpu_generation?: number;
  mb_cpu_gen_max?: number;
  mb_bios_cpu_gen_ready?: number;
  cooler_tdp_w?: number;
  cooler_type?: "air" | "aio" | "other";
  cooler_height_mm?: number;
  case_cooler_max_mm?: number;
  radiator_size_mm?: number;
  case_radiator_max_mm?: number;
  gpu_thickness_slots?: number;
  case_gpu_max_slots?: number;
  mb_m2_slots?: number;
  mb_sata_ports?: number;
  mb_sata_ports_disabled_with_m2?: number;
  mb_pcie_x16_slots?: number;
}

export type PcBuildSelection = Partial<Record<PcComponentType, number>>;

export interface CompatibilityResult {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface PcBuildDiscountDetails {
  percentage: number;
  amount: number;
  label: string;
}

export interface PcBuildCartMetaItem {
  slotKey?: PcComponentType | string;
  productId: number;
  quantity: number;
}

export interface PcBuildCartMeta {
  source?: string;
  build_id?: string | null;
  discount_pct?: number;
  bundle_items?: PcBuildCartMetaItem[];
  updated_at?: string;
}

export interface PcBuildCartItem {
  productId: number;
  quantity: number;
  totalWithIVA: number;
}

export interface PcBuildCartDiscount extends PcBuildDiscountDetails {
  eligible: boolean;
}

export interface DiscountedTotals {
  subtotal: number;
  ivaTotal: number;
  total: number;
}

export type PcBuildGoal = "office" | "gaming" | "workstation";

export interface PcBuildProfilePreset {
  key: PcBuildGoal;
  label: string;
  noise: "bajo" | "medio" | "alto";
  power: "eficiente" | "balanceado" | "performance";
  performance: "base" | "alta" | "extrema";
  psuHeadroomFactor: number;
}

export interface PcCanonicalPreviewItem {
  rawKey: string;
  canonicalKey: PcCanonicalSpecKey;
  rawValue: string;
  normalizedValue: string;
}

export interface PcCatalogEntry {
  product: Product;
  componentType: PcComponentType | null;
  specs: PcSpecsNormalized;
  missingCritical: PcCanonicalSpecKey[];
  eligible: boolean;
  canonicalPreview: PcCanonicalPreviewItem[];
}

export interface PcCatalogBuildOptions {
  includeInactive?: boolean;
  includeUnknownType?: boolean;
  includeOutOfStock?: boolean;
}

export const PC_CRITICAL_KEYS_BY_COMPONENT: Record<PcComponentType, PcCanonicalSpecKey[]> = {
  cpu: ["socket"],
  motherboard: ["socket", "memory_type", "form_factor"],
  ram: ["memory_type"],
  gpu: ["interface"],
  storage: ["interface"],
  storage_secondary: ["interface"],
  psu: ["wattage"],
  case: [],
  cooler: [],
  monitor: [],
};

const PC_CANONICAL_KEY_LABELS: Record<PcCanonicalSpecKey, string> = {
  socket: "Socket",
  platform_brand: "Plataforma",
  memory_type: "Tipo de memoria",
  form_factor: "Form factor",
  wattage: "Potencia (W)",
  tdp_w: "TDP (W)",
  socket_supported: "Sockets soportados",
  interface: "Interfaz",
  gpu_length_mm: "Largo GPU (mm)",
  case_gpu_max_mm: "GPU máx. gabinete (mm)",
  ram_speed_mts: "Velocidad RAM (MT/s)",
  mb_max_ram_speed_mts: "Velocidad RAM máx motherboard (MT/s)",
  ram_profiles: "Perfiles RAM (JEDEC/XMP/EXPO)",
  mb_ram_profiles: "Perfiles RAM soportados por motherboard",
  cpu_generation: "Generación CPU",
  mb_cpu_gen_max: "Generación CPU máx por chipset",
  mb_bios_cpu_gen_ready: "Generación CPU lista en BIOS actual",
  cooler_tdp_w: "Capacidad de disipación cooler (W)",
  cooler_type: "Tipo de cooler",
  cooler_height_mm: "Altura cooler (mm)",
  case_cooler_max_mm: "Altura máx cooler gabinete (mm)",
  radiator_size_mm: "Tamaño radiador (mm)",
  case_radiator_max_mm: "Radiador máx gabinete (mm)",
  gpu_thickness_slots: "Espesor GPU (slots)",
  case_gpu_max_slots: "Espesor GPU máx gabinete (slots)",
  mb_m2_slots: "Slots M.2 motherboard",
  mb_sata_ports: "Puertos SATA motherboard",
  mb_sata_ports_disabled_with_m2: "Puertos SATA deshabilitados por M.2",
  mb_pcie_x16_slots: "Slots PCIe x16 motherboard",
};

const CANONICAL_SPEC_ALIASES: Record<PcCanonicalSpecKey, string[]> = {
  socket: [
    "socket",
    "cpu_socket",
    "socket_cpu",
    "motherboard_socket",
    "zocalo",
    "zocalo_cpu",
    "socket_type",
  ],
  platform_brand: [
    "platform_brand",
    "platform",
    "cpu_brand",
    "socket_brand",
    "marca_plataforma",
    "chipset_brand",
  ],
  memory_type: [
    "memory_type",
    "ram_type",
    "memory",
    "tipo_memoria",
    "memory_standard",
    "ram_standard",
    "ddr",
  ],
  form_factor: [
    "form_factor",
    "mb_form_factor",
    "motherboard_form_factor",
    "case_form_factor",
    "factor_forma",
    "formato",
    "supported_form_factor",
    "supports_form_factor",
  ],
  wattage: [
    "wattage",
    "power_w",
    "potencia",
    "potencia_w",
    "psu_wattage",
    "power_supply_wattage",
    "watts",
  ],
  tdp_w: [
    "tdp_w",
    "tdp",
    "cpu_tdp",
    "gpu_tdp",
    "consumo_w",
    "power_draw_w",
  ],
  socket_supported: [
    "socket_supported",
    "supported_sockets",
    "cooler_socket",
    "cooler_sockets",
    "socket_compatible",
    "compat_socket",
    "socket_support",
  ],
  interface: [
    "interface",
    "interfaces",
    "slot_interface",
    "gpu_interface",
    "storage_interface",
    "pcie",
    "pcie_slot",
    "bus",
    "connector",
    "sata",
    "m2_interface",
    "nvme_interface",
  ],
  gpu_length_mm: [
    "gpu_length_mm",
    "gpu_length",
    "gpu_max_length_mm",
    "vga_length_mm",
    "longitud_gpu_mm",
    "length_mm",
  ],
  case_gpu_max_mm: [
    "case_gpu_max_mm",
    "gpu_max_mm",
    "max_gpu_length_mm",
    "max_gpu_mm",
    "longitud_gpu_max_mm",
    "case_max_gpu_mm",
  ],
  ram_speed_mts: ["ram_speed_mts", "memory_speed", "ram_speed", "speed_mhz", "mhz", "mts"],
  mb_max_ram_speed_mts: ["mb_max_ram_speed_mts", "max_memory_speed", "max_ram_speed", "memory_speed_max"],
  ram_profiles: ["ram_profiles", "memory_profiles", "profiles", "xmp_expo", "profile_support"],
  mb_ram_profiles: ["mb_ram_profiles", "mb_memory_profiles", "motherboard_memory_profiles", "memory_profiles_supported"],
  cpu_generation: ["cpu_generation", "gen", "generation", "cpu_gen"],
  mb_cpu_gen_max: ["mb_cpu_gen_max", "chipset_cpu_gen_max", "cpu_gen_max", "supported_cpu_gen_max"],
  mb_bios_cpu_gen_ready: ["mb_bios_cpu_gen_ready", "bios_cpu_gen_ready", "bios_ready_gen", "bios_generation_ready"],
  cooler_tdp_w: ["cooler_tdp_w", "cooling_capacity_w", "cooler_capacity_w", "dissipation_w"],
  cooler_type: ["cooler_type", "cooling_type", "refrigeration_type"],
  cooler_height_mm: ["cooler_height_mm", "cooler_height", "height_mm_cooler", "cpu_cooler_height_mm"],
  case_cooler_max_mm: ["case_cooler_max_mm", "max_cooler_height_mm", "cooler_clearance_mm"],
  radiator_size_mm: ["radiator_size_mm", "radiator_mm", "aio_radiator_mm"],
  case_radiator_max_mm: ["case_radiator_max_mm", "max_radiator_mm", "radiator_support_mm"],
  gpu_thickness_slots: ["gpu_thickness_slots", "gpu_slots", "gpu_slot_width", "gpu_slot_thickness"],
  case_gpu_max_slots: ["case_gpu_max_slots", "max_gpu_slots", "gpu_slot_limit"],
  mb_m2_slots: ["mb_m2_slots", "m2_slots", "motherboard_m2_slots"],
  mb_sata_ports: ["mb_sata_ports", "sata_ports", "motherboard_sata_ports"],
  mb_sata_ports_disabled_with_m2: ["mb_sata_ports_disabled_with_m2", "sata_disabled_by_m2", "m2_sata_shared_ports"],
  mb_pcie_x16_slots: ["mb_pcie_x16_slots", "pcie_x16_slots", "motherboard_pcie_x16_slots"],
};

const COMPONENT_TYPE_ALIASES: Record<PcComponentType, string[]> = {
  cpu: ["cpu", "procesador", "processor"],
  motherboard: ["motherboard", "mother", "placa madre", "mainboard"],
  ram: ["ram", "memoria", "memory"],
  gpu: ["gpu", "placa de video", "video", "vga", "grafica", "graphics"],
  storage: ["storage", "almacenamiento", "ssd", "hdd", "nvme", "m.2", "disco"],
  storage_secondary: ["storage", "almacenamiento", "ssd", "hdd", "nvme", "m.2", "disco"],
  psu: ["psu", "fuente", "power supply"],
  case: ["case", "gabinete", "chassis", "tower"],
  cooler: ["cooler", "disipador", "refrigeracion", "watercooling", "fan", "ventilador"],
  monitor: ["monitor", "pantalla", "display"],
};

const PC_BUILD_DISCOUNT_TIERS: Record<"ARS" | "USD", Array<{ minTotal: number; percentage: number; label: string }>> = {
  ARS: [
    { minTotal: 500000, percentage: 2, label: "Starter" },
    { minTotal: 1200000, percentage: 4, label: "Business" },
    { minTotal: 2200000, percentage: 5, label: "Pro" },
  ],
  USD: [
    { minTotal: 700, percentage: 2, label: "Starter" },
    { minTotal: 1500, percentage: 4, label: "Business" },
    { minTotal: 2800, percentage: 5, label: "Pro" },
  ],
};

const PC_BUILD_PROFILE_PRESETS: Record<PcBuildGoal, PcBuildProfilePreset> = {
  office: {
    key: "office",
    label: "Oficina",
    noise: "bajo",
    power: "eficiente",
    performance: "base",
    psuHeadroomFactor: 1.18,
  },
  gaming: {
    key: "gaming",
    label: "Gaming",
    noise: "alto",
    power: "performance",
    performance: "extrema",
    psuHeadroomFactor: 1.3,
  },
  workstation: {
    key: "workstation",
    label: "Workstation",
    noise: "medio",
    power: "balanceado",
    performance: "alta",
    psuHeadroomFactor: 1.25,
  },
};

function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeSpecKey(value: string): string {
  return normalizeToken(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function splitMultiValue(raw: string): string[] {
  return raw
    .split(/[,/|;+]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseFirstNumber(raw: string): number | undefined {
  const match = raw.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRoundedNumber(raw: string): number | undefined {
  const parsed = parseFirstNumber(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed as number);
}

function normalizeProfiles(raw: string): string[] {
  const normalized = normalizeToken(raw);
  const profiles: string[] = [];
  if (normalized.includes("jedec")) profiles.push("JEDEC");
  if (normalized.includes("xmp")) profiles.push("XMP");
  if (normalized.includes("expo")) profiles.push("EXPO");
  return uniq(profiles);
}

function inferCpuGenerationFromText(rawText: string): number | undefined {
  const text = normalizeToken(rawText);

  // Intel style: i5-14400 / i7 12700 / ultra 7 155h -> 14 / 12 / 1
  const intelMatch = text.match(/\b(?:i3|i5|i7|i9|ultra)\s*[- ]?(\d{4,5})[a-z]?\b/);
  if (intelMatch) {
    const digits = intelMatch[1];
    if (digits.length >= 4) {
      return Number(digits.slice(0, digits.length - 3));
    }
  }

  // AMD Ryzen style: 5600X / 7600X / 9700X -> 5 / 7 / 9
  const ryzenMatch = text.match(/\bryzen\s*[3579]?\s*(\d{4})[a-z]?\b/);
  if (ryzenMatch) {
    return Number(ryzenMatch[1].slice(0, 1));
  }

  return undefined;
}

function inferCoolerType(rawText: string): "air" | "aio" | "other" | undefined {
  const text = normalizeToken(rawText);
  if (!text) return undefined;
  if (/\b(aio|watercool|water cooling|liquid|refrigeracion liquida|radiador)\b/.test(text)) {
    return "aio";
  }
  if (/\b(cooler|disipador|heatsink|fan)\b/.test(text)) {
    return "air";
  }
  return undefined;
}

function detectMemorySpeedFromText(rawText: string): number | undefined {
  const text = normalizeToken(rawText);
  const match = text.match(/\b(\d{3,5})\s?(mhz|mts)\b/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  return Math.round(value);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeToWordGroups(value: string): string {
  return normalizeToken(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliasWordMatch(value: string, alias: string): boolean {
  const normalizedValue = normalizeToWordGroups(value);
  const normalizedAlias = normalizeToWordGroups(alias);
  if (!normalizedValue || !normalizedAlias) return false;
  return (` ${normalizedValue} `).includes(` ${normalizedAlias} `);
}

function normalizeSocket(raw: string): string | undefined {
  const value = normalizeToken(raw);
  if (!value) return undefined;

  const sMatch = value.match(/\bs[\s-]?(\d{4})\b/);
  if (sMatch) return `LGA${sMatch[1]}`;

  const amMatch = value.match(/\bam\s?(1|2|3|4|5)\b/);
  if (amMatch) return `AM${amMatch[1]}`;

  const fmMatch = value.match(/\bfm\s?(1|2)\b/);
  if (fmMatch) return `FM${fmMatch[1]}`;

  if (/\btrx4\b/.test(value)) return "TRX4";
  if (/\btr4\b/.test(value)) return "TR4";

  const lgaMatch = value.match(/\blga[\s-]?(\d{3,4})\b|\b(\d{4})\b/);
  if (lgaMatch) {
    const digits = lgaMatch[1] || lgaMatch[2];
    if (digits) return `LGA${digits}`;
  }

  return value.toUpperCase().replace(/\s+/g, "");
}

function normalizePlatformBrand(raw: string, socket?: string): string | undefined {
  const value = normalizeToken(raw);
  if (value.includes("intel")) return "intel";
  if (value.includes("amd")) return "amd";

  if (socket?.startsWith("LGA")) return "intel";
  if (socket?.startsWith("AM")) return "amd";
  return value || undefined;
}

function normalizeMemoryType(raw: string): string | undefined {
  const value = normalizeToken(raw);
  if (!value) return undefined;
  if (value.includes("ddr5")) return "DDR5";
  if (value.includes("ddr4")) return "DDR4";
  if (value.includes("ddr3")) return "DDR3";
  return raw.trim().toUpperCase();
}

function normalizeFormFactor(raw: string): string | undefined {
  const value = normalizeToken(raw);
  if (!value) return undefined;
  if (value.includes("so-dimm") || value.includes("sodimm")) return "SO-DIMM";
  if (value.includes("u-dimm") || value.includes("udimm")) return "UDIMM";
  if (value.includes("dimm")) return "DIMM";
  if (value.includes("micro") && value.includes("atx")) return "mATX";
  if (value.includes("mini") && value.includes("itx")) return "Mini-ITX";
  if (value.includes("e-atx") || value.includes("eatx") || value.includes("extended atx")) return "E-ATX";
  if (value === "atx" || value.endsWith(" atx") || value.startsWith("atx ")) return "ATX";
  if (value.includes("itx")) return "Mini-ITX";
  if (value.includes("matx")) return "mATX";
  return raw.trim().toUpperCase();
}

function normalizeInterface(raw: string): string | undefined {
  const value = normalizeToken(raw);
  if (!value) return undefined;
  if (value.includes("pcie")) return "PCIe";
  if (value.includes("nvme")) return "NVMe";
  if (value.includes("m2") || value.includes("m.2")) return "M.2";
  if (value.includes("sata")) return "SATA";
  if (value.includes("usb")) return "USB";
  return raw.trim();
}

function extractProductText(
  product: Partial<Pick<Product, "name" | "name_custom" | "name_original" | "category" | "brand_name">>,
): string {
  return [
    product.name_custom?.trim(),
    product.name_original?.trim(),
    product.name?.trim(),
    product.category?.trim(),
    product.brand_name?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

function inferSocketFromText(rawText: string): string | undefined {
  const text = normalizeToken(rawText);
  if (!text) return undefined;

  const sMatch = text.match(/\bs[\s-]?(\d{4})\b/);
  if (sMatch) return `LGA${sMatch[1]}`;

  const amMatch = text.match(/\bam[\s-]?(1|2|3|4|5)\b/);
  if (amMatch) return `AM${amMatch[1]}`;

  const fmMatch = text.match(/\bfm[\s-]?(1|2)\b/);
  if (fmMatch) return `FM${fmMatch[1]}`;

  if (/\btrx4\b/.test(text)) return "TRX4";
  if (/\btr4\b/.test(text)) return "TR4";

  const socketAmMatch = text.match(/\bsocket[\s:-]?(am[\s-]?[12345])\b/);
  if (socketAmMatch) {
    const digits = socketAmMatch[1].replace(/[^345]/g, "");
    if (digits) return `AM${digits}`;
  }

  const lgaMatch = text.match(/\blga[\s-]?(\d{3,4})\b/);
  if (lgaMatch) return `LGA${lgaMatch[1]}`;

  const socketNumericMatch = text.match(/\bsocket[\s:-]?(\d{3,4})\b/);
  if (socketNumericMatch) return `LGA${socketNumericMatch[1]}`;

  return undefined;
}

function inferMemoryTypeFromText(rawText: string): string | undefined {
  const text = normalizeToken(rawText);
  if (text.includes("ddr5")) return "DDR5";
  if (text.includes("ddr4")) return "DDR4";
  if (text.includes("ddr3")) return "DDR3";
  return undefined;
}

function inferPlatformBrandFromText(rawText: string, socket?: string): string | undefined {
  const text = normalizeToken(rawText);
  if (text.includes("intel")) return "intel";
  if (text.includes("amd")) return "amd";
  if (socket?.startsWith("LGA")) return "intel";
  if (socket?.startsWith("AM")) return "amd";
  return undefined;
}

function inferFormFactorFromText(rawText: string): string[] {
  const text = normalizeToken(rawText);
  const values: string[] = [];
  if (text.includes("so-dimm") || text.includes("sodimm")) values.push("SO-DIMM");
  if (text.includes("u-dimm") || text.includes("udimm")) values.push("UDIMM");
  if (/\bdimm\b/.test(text) && !text.includes("so-dimm") && !text.includes("sodimm")) values.push("DIMM");
  if (text.includes("eatx") || text.includes("e-atx")) values.push("E-ATX");
  if (text.includes("matx") || (text.includes("micro") && text.includes("atx"))) values.push("mATX");
  if (text.includes("itx")) values.push("Mini-ITX");
  if (text.includes(" atx") || text.startsWith("atx") || text.includes("atx ")) values.push("ATX");
  return uniq(values);
}

function inferInterfacesFromText(rawText: string): string[] {
  const text = normalizeToken(rawText);
  const values: string[] = [];
  if (/\b(gpu|placa de video|vga|rtx|gtx|geforce|radeon|arc)\b/.test(text)) values.push("PCIe");
  if (/\b(motherboard|placa madre|mainboard|chipset|b\d{3}|h\d{3}|z\d{3}|x\d{3}|a\d{3})\b/.test(text)) values.push("PCIe");
  if (text.includes("pcie")) values.push("PCIe");
  if (text.includes("nvme")) values.push("NVMe");
  if (text.includes("m.2") || text.includes("m2")) values.push("M.2");
  if (text.includes("sata")) values.push("SATA");
  if (text.includes("usb")) values.push("USB");
  return uniq(values);
}

function inferWattageFromText(rawText: string): number | undefined {
  const text = normalizeToken(rawText);
  const match = text.match(/\b(\d{2,4})\s?w\b/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function inferSocketSupportedFromText(rawText: string): string[] {
  const text = normalizeToken(rawText);
  if (!text) return [];
  const sockets: string[] = [];

  for (const match of text.matchAll(/\bs[\s-]?(\d{4})\b/g)) {
    sockets.push(`LGA${match[1]}`);
  }

  for (const match of text.matchAll(/\blga[\s-]?(\d{3,4})\b/g)) {
    sockets.push(`LGA${match[1]}`);
  }

  for (const match of text.matchAll(/\bam[\s-]?(1|2|3|4|5)\b/g)) {
    sockets.push(`AM${match[1]}`);
  }

  for (const match of text.matchAll(/\bfm[\s-]?(1|2)\b/g)) {
    sockets.push(`FM${match[1]}`);
  }

  if (/\btrx4\b/.test(text)) sockets.push("TRX4");
  if (/\btr4\b/.test(text)) sockets.push("TR4");

  for (const match of text.matchAll(/\bsocket[\s:-]?(\d{3,4})\b/g)) {
    sockets.push(`LGA${match[1]}`);
  }

  for (const match of text.matchAll(/\bsocket[\s:-]?(am[\s-]?[12345])\b/g)) {
    const digits = match[1].replace(/[^345]/g, "");
    if (digits) sockets.push(`AM${digits}`);
  }

  return uniq(sockets.map((raw) => normalizeSocket(raw)).filter(Boolean) as string[]);
}

function toSpecsRecord(product: Pick<Product, "specs">): Record<string, unknown> {
  const raw = product.specs as unknown;
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function buildNormalizedSpecsIndex(specs: Record<string, unknown>) {
  const byNormalizedKey = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(specs)) {
    if (rawValue === null || rawValue === undefined) continue;
    const normalizedKey = normalizeSpecKey(rawKey);
    if (!normalizedKey) continue;
    if (Array.isArray(rawValue)) {
      const compact = rawValue.map((item) => String(item)).join(", ");
      byNormalizedKey.set(normalizedKey, compact);
      continue;
    }
    byNormalizedKey.set(normalizedKey, String(rawValue));
  }
  return byNormalizedKey;
}

function resolveCanonicalValue(
  normalizedIndex: Map<string, string>,
  canonicalKey: PcCanonicalSpecKey,
): string {
  const aliases = [canonicalKey, ...(CANONICAL_SPEC_ALIASES[canonicalKey] ?? [])];
  for (const alias of aliases) {
    const value = normalizedIndex.get(normalizeSpecKey(alias));
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function mapRawKeyToCanonical(rawKey: string): PcCanonicalSpecKey | null {
  const normalized = normalizeSpecKey(rawKey);
  if (!normalized) return null;

  for (const canonicalKey of PC_CANONICAL_KEYS) {
    const aliases = [canonicalKey, ...(CANONICAL_SPEC_ALIASES[canonicalKey] ?? [])];
    if (aliases.some((alias) => normalizeSpecKey(alias) === normalized)) {
      return canonicalKey;
    }
  }
  return null;
}

function hasCriticalValue(key: PcCanonicalSpecKey, specs: PcSpecsNormalized): boolean {
  const value = specs[key];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function isExcludedFromPcBuilder(
  componentType: PcComponentType,
  specs: PcSpecsNormalized,
  product: Pick<Product, "name" | "name_custom" | "name_original">,
): boolean {
  const displayName = product.name_custom?.trim() || product.name_original?.trim() || product.name || "";
  const haystack = normalizeToken(displayName);

  // Hard exclusion for DDR3 regardless of specs
  if (haystack.includes("ddr3")) return true;

  if (componentType === "ram") {
    const memoryType = normalizeToken(specs.memory_type);
    if (memoryType === "ddr3") return true;
  }
  return false;
}

function interfaceOverlap(left: string[] | undefined, right: string[] | undefined): boolean {
  if (!left || !right || left.length === 0 || right.length === 0) return true;
  const a = left.map((item) => normalizeToken(item));
  const b = right.map((item) => normalizeToken(item));

  if (a.some((item) => b.includes(item))) return true;
  const aHasPcie = a.some((item) => item.includes("pcie"));
  const bHasPcie = b.some((item) => item.includes("pcie"));
  return aHasPcie && bHasPcie;
}

function estimateRecommendedPsu(cpuTdp?: number, gpuTdp?: number, headroomFactor = 1.25): number {
  const base = 120;
  const cpu = Number.isFinite(cpuTdp) ? Number(cpuTdp) : 95;
  const gpu = Number.isFinite(gpuTdp) ? Number(gpuTdp) : 180;
  return Math.ceil((base + cpu + gpu) * headroomFactor);
}

export function getPcBuildDiscount(total: number, currency: "ARS" | "USD"): PcBuildDiscountDetails {
  const normalizedTotal = Math.max(0, total);
  const tiers = PC_BUILD_DISCOUNT_TIERS[currency];
  const selectedTier = [...tiers].reverse().find((tier) => normalizedTotal >= tier.minTotal);
  const percentage = selectedTier?.percentage ?? 0;
  const amount = Number(((normalizedTotal * percentage) / 100).toFixed(2));
  return {
    percentage,
    amount,
    label: selectedTier?.label ?? "Sin descuento",
  };
}

export function getPcBuildCartDiscount(
  meta: PcBuildCartMeta | null | undefined,
  cartItems: PcBuildCartItem[],
): PcBuildCartDiscount {
  const percentage = Math.max(0, Number(meta?.discount_pct ?? 0));
  const bundleItems = Array.isArray(meta?.bundle_items) ? meta.bundle_items : [];

  if (!meta || meta.source !== "pc_builder" || percentage <= 0 || bundleItems.length === 0) {
    return { percentage: 0, amount: 0, label: "Sin descuento", eligible: false };
  }

  const cartByProductId = new Map<number, PcBuildCartItem>();
  cartItems.forEach((item) => {
    if (item.quantity <= 0 || item.totalWithIVA <= 0) return;
    cartByProductId.set(item.productId, item);
  });

  let bundleTotalWithIva = 0;
  for (const bundleItem of bundleItems) {
    const requestedQty = Math.max(1, Number(bundleItem.quantity ?? 1));
    const cartLine = cartByProductId.get(bundleItem.productId);
    if (!cartLine || cartLine.quantity < requestedQty) {
      return { percentage: 0, amount: 0, label: "Sin descuento", eligible: false };
    }

    const unitTotalWithIva = cartLine.totalWithIVA / cartLine.quantity;
    bundleTotalWithIva += unitTotalWithIva * requestedQty;
  }

  const amount = Number(((Math.max(0, bundleTotalWithIva) * percentage) / 100).toFixed(2));
  if (amount <= 0) {
    return { percentage: 0, amount: 0, label: "Sin descuento", eligible: false };
  }

  return {
    percentage,
    amount,
    label: `Armador PC ${percentage}%`,
    eligible: true,
  };
}

export function applyTotalDiscount(subtotal: number, ivaTotal: number, discountAmount: number): DiscountedTotals {
  const normalizedSubtotal = Math.max(0, subtotal);
  const normalizedIva = Math.max(0, ivaTotal);
  const baseTotal = normalizedSubtotal + normalizedIva;
  const clampedDiscount = Math.min(Math.max(0, discountAmount), baseTotal);

  if (baseTotal <= 0 || clampedDiscount <= 0) {
    return {
      subtotal: Number(normalizedSubtotal.toFixed(2)),
      ivaTotal: Number(normalizedIva.toFixed(2)),
      total: Number(baseTotal.toFixed(2)),
    };
  }

  const subtotalDiscount = Number(((clampedDiscount * normalizedSubtotal) / baseTotal).toFixed(2));
  const ivaDiscount = Number((clampedDiscount - subtotalDiscount).toFixed(2));

  const nextSubtotal = Number(Math.max(0, normalizedSubtotal - subtotalDiscount).toFixed(2));
  const nextIvaTotal = Number(Math.max(0, normalizedIva - ivaDiscount).toFixed(2));

  return {
    subtotal: nextSubtotal,
    ivaTotal: nextIvaTotal,
    total: Number((nextSubtotal + nextIvaTotal).toFixed(2)),
  };
}

export function getPcBuildProfilePreset(goal: PcBuildGoal): PcBuildProfilePreset {
  return PC_BUILD_PROFILE_PRESETS[goal];
}

export function estimatePsuRequirement(cpuTdp?: number, gpuTdp?: number, goal: PcBuildGoal = "workstation"): number {
  const preset = getPcBuildProfilePreset(goal);
  return estimateRecommendedPsu(cpuTdp, gpuTdp, preset.psuHeadroomFactor);
}

export function getCanonicalKeyLabel(key: PcCanonicalSpecKey): string {
  return PC_CANONICAL_KEY_LABELS[key];
}

export function getProductSpecsRecord(product: Pick<Product, "specs">): Record<string, unknown> {
  return toSpecsRecord(product);
}

export function parsePsuWattage(
  product: Pick<Product, "specs"> & Partial<Pick<Product, "name" | "name_custom" | "name_original">>,
): number | undefined {
  const specs = extractPcSpecs(product);
  if (typeof specs.wattage === "number" && Number.isFinite(specs.wattage) && specs.wattage > 0) {
    return specs.wattage;
  }
  return undefined;
}

export function extractPcSpecs(
  product: Pick<Product, "specs"> &
    Partial<Pick<Product, "name" | "name_custom" | "name_original" | "category" | "brand_name">>,
): PcSpecsNormalized {
  const rawSpecs = toSpecsRecord(product);
  const normalizedIndex = buildNormalizedSpecsIndex(rawSpecs);
  const productText = extractProductText(product);

  const socket = normalizeSocket(resolveCanonicalValue(normalizedIndex, "socket")) ?? inferSocketFromText(productText);
  const platformBrand =
    normalizePlatformBrand(resolveCanonicalValue(normalizedIndex, "platform_brand"), socket) ??
    inferPlatformBrandFromText(productText, socket);

  const memoryType = normalizeMemoryType(resolveCanonicalValue(normalizedIndex, "memory_type")) ?? inferMemoryTypeFromText(productText);
  const rawFormFactor = resolveCanonicalValue(normalizedIndex, "form_factor");
  const rawSocketSupported = resolveCanonicalValue(normalizedIndex, "socket_supported");
  const rawInterfaces = resolveCanonicalValue(normalizedIndex, "interface");
  const rawRamProfiles = resolveCanonicalValue(normalizedIndex, "ram_profiles");
  const rawMotherboardProfiles = resolveCanonicalValue(normalizedIndex, "mb_ram_profiles");
  const rawCoolerType = resolveCanonicalValue(normalizedIndex, "cooler_type");

  const formFactor = uniq([
    ...(splitMultiValue(rawFormFactor).map(normalizeFormFactor).filter(Boolean) as string[]),
    ...inferFormFactorFromText(productText),
  ]);
  const socketSupported = uniq([
    ...(splitMultiValue(rawSocketSupported).map(normalizeSocket).filter(Boolean) as string[]),
    ...inferSocketSupportedFromText(productText),
  ]);
  const interfaces = uniq([
    ...(splitMultiValue(rawInterfaces).map(normalizeInterface).filter(Boolean) as string[]),
    ...inferInterfacesFromText(productText),
  ]);
  const ramProfiles = uniq([
    ...normalizeProfiles(rawRamProfiles),
    ...normalizeProfiles(productText),
  ]);
  const motherboardProfiles = uniq([
    ...normalizeProfiles(rawMotherboardProfiles),
    ...normalizeProfiles(productText),
  ]);

  const wattage = parseFirstNumber(resolveCanonicalValue(normalizedIndex, "wattage")) ?? inferWattageFromText(productText);
  const tdpW = parseFirstNumber(resolveCanonicalValue(normalizedIndex, "tdp_w"));
  const gpuLength = parseFirstNumber(resolveCanonicalValue(normalizedIndex, "gpu_length_mm"));
  const caseGpuMax = parseFirstNumber(resolveCanonicalValue(normalizedIndex, "case_gpu_max_mm"));
  const ramSpeedMts = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "ram_speed_mts")) ?? detectMemorySpeedFromText(productText);
  const mbMaxRamSpeedMts = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_max_ram_speed_mts"));
  const cpuGeneration = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "cpu_generation")) ?? inferCpuGenerationFromText(productText);
  const mbCpuGenMax = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_cpu_gen_max"));
  const mbBiosCpuGenReady = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_bios_cpu_gen_ready"));
  const coolerTdpW = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "cooler_tdp_w"));
  const coolerHeightMm = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "cooler_height_mm")) ?? parseRoundedNumber(productText);
  const caseCoolerMaxMm = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "case_cooler_max_mm"));
  const radiatorSizeMm = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "radiator_size_mm")) ?? parseRoundedNumber(productText);
  const caseRadiatorMaxMm = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "case_radiator_max_mm"));
  const gpuThicknessSlots = parseFirstNumber(resolveCanonicalValue(normalizedIndex, "gpu_thickness_slots"));
  const caseGpuMaxSlots = parseFirstNumber(resolveCanonicalValue(normalizedIndex, "case_gpu_max_slots"));
  const mbM2Slots = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_m2_slots"));
  const mbSataPorts = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_sata_ports"));
  const mbSataDisabledWithM2 = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_sata_ports_disabled_with_m2"));
  const mbPcieX16Slots = parseRoundedNumber(resolveCanonicalValue(normalizedIndex, "mb_pcie_x16_slots"));
  const inferredCoolerType = inferCoolerType(rawCoolerType || productText);

  return {
    socket,
    platform_brand: platformBrand,
    memory_type: memoryType,
    form_factor: formFactor.length > 0 ? formFactor : undefined,
    wattage: wattage && wattage > 0 ? wattage : undefined,
    tdp_w: tdpW && tdpW > 0 ? tdpW : undefined,
    socket_supported: socketSupported.length > 0 ? socketSupported : undefined,
    interface: interfaces.length > 0 ? interfaces : undefined,
    gpu_length_mm: gpuLength && gpuLength > 0 ? gpuLength : undefined,
    case_gpu_max_mm: caseGpuMax && caseGpuMax > 0 ? caseGpuMax : undefined,
    ram_speed_mts: ramSpeedMts && ramSpeedMts > 0 ? ramSpeedMts : undefined,
    mb_max_ram_speed_mts: mbMaxRamSpeedMts && mbMaxRamSpeedMts > 0 ? mbMaxRamSpeedMts : undefined,
    ram_profiles: ramProfiles.length > 0 ? ramProfiles : undefined,
    mb_ram_profiles: motherboardProfiles.length > 0 ? motherboardProfiles : undefined,
    cpu_generation: cpuGeneration && cpuGeneration > 0 ? cpuGeneration : undefined,
    mb_cpu_gen_max: mbCpuGenMax && mbCpuGenMax > 0 ? mbCpuGenMax : undefined,
    mb_bios_cpu_gen_ready: mbBiosCpuGenReady && mbBiosCpuGenReady > 0 ? mbBiosCpuGenReady : undefined,
    cooler_tdp_w: coolerTdpW && coolerTdpW > 0 ? coolerTdpW : undefined,
    cooler_type: inferredCoolerType,
    cooler_height_mm: coolerHeightMm && coolerHeightMm > 0 ? coolerHeightMm : undefined,
    case_cooler_max_mm: caseCoolerMaxMm && caseCoolerMaxMm > 0 ? caseCoolerMaxMm : undefined,
    radiator_size_mm: radiatorSizeMm && radiatorSizeMm > 0 ? radiatorSizeMm : undefined,
    case_radiator_max_mm: caseRadiatorMaxMm && caseRadiatorMaxMm > 0 ? caseRadiatorMaxMm : undefined,
    gpu_thickness_slots: gpuThicknessSlots && gpuThicknessSlots > 0 ? Number(gpuThicknessSlots.toFixed(1)) : undefined,
    case_gpu_max_slots: caseGpuMaxSlots && caseGpuMaxSlots > 0 ? Number(caseGpuMaxSlots.toFixed(1)) : undefined,
    mb_m2_slots: mbM2Slots && mbM2Slots > 0 ? mbM2Slots : undefined,
    mb_sata_ports: mbSataPorts && mbSataPorts > 0 ? mbSataPorts : undefined,
    mb_sata_ports_disabled_with_m2: mbSataDisabledWithM2 && mbSataDisabledWithM2 > 0 ? mbSataDisabledWithM2 : undefined,
    mb_pcie_x16_slots: mbPcieX16Slots && mbPcieX16Slots > 0 ? mbPcieX16Slots : undefined,
  };
}

export function inferPcComponentType(
  product: Pick<Product, "name" | "name_custom" | "name_original" | "category" | "specs"> &
    Partial<Pick<Product, "brand_name">>,
): PcComponentType | null {
  const specs = toSpecsRecord(product);
  const normalizedIndex = buildNormalizedSpecsIndex(specs);
  const explicitType =
    normalizedIndex.get("pc_component_type") ||
    normalizedIndex.get("component_type") ||
    normalizedIndex.get("builder_component") ||
    normalizedIndex.get("tipo_componente");

  if (explicitType) {
    const normalized = normalizeToken(explicitType);
    for (const [type, aliases] of Object.entries(COMPONENT_TYPE_ALIASES) as Array<[PcComponentType, string[]]>) {
      if (aliases.some((alias) => aliasWordMatch(normalized, alias))) {
        return type;
      }
    }
  }

  const displayName = product.name_custom?.trim() || product.name_original?.trim() || product.name || "";
  const normalizedDisplayName = normalizeToken(displayName);
  const haystack = normalizeToken([displayName, product.category ?? "", product.brand_name ?? ""].join(" "));
  const looksLikeFullSystem = /\b(mini pc|notebook|laptop|all in one pc|pc armad|equipo completo)\b/.test(haystack);
  if (looksLikeFullSystem) return null;

  const hasCpuSignature =
    /\b(cpu|procesador(?:es)?|processor(?:s)?|ryzen|core(?:\s|-)?i|core ultra|celeron|pentium|athlon|threadripper)\b/.test(
      haystack,
    );
  const hasCpuWithoutCoolerPhrase = /\b(sin cooler|s\/cooler)\b/.test(haystack);
  const hasPowerSupplyContext = /\b(psu|fuente|power supply|80 plus|\d{3,4}\s?w)\b/.test(haystack);
  const hasAioCoolingContext =
    /\baio\b/.test(haystack) &&
    /\b(water|liquid|cooler|cpu|radiador|refrigeracion|coreliquid|masterliquid|watercooler)\b/.test(haystack);
  const hasFanCoolingContext = /\b(fan(?:es)?|ventilador(?:es)?|cooler(?:es)?|refrigeracion)\b/.test(haystack);
  const isCpuCoolerProduct =
    /\b(cooler de procesador|cpu cooler|disipador|watercooling|liquid cooler|heatsink|radiador|refrigeracion liquida)\b/.test(haystack) ||
    /\bfan cooler\b/.test(haystack) ||
    hasAioCoolingContext;
  const isClearlyNonCoolerAccessory =
    /\b(auricular|headset|silla|chair|teclado|keyboard|mouse|mause|parlante|speaker|webcam|microfono|impresora|printer|smart tank|router|switch|toner|drum|cartucho|tinta|insumo)\b/.test(
      haystack,
    );
  const isClearlyNonPsuContext = /\b(ups|no-break|bateria|battery|estabilizador|estabilizadores|drum|toner|cartucho|tinta|insumo)\b/.test(haystack);
  const isClearlyNonCaseAccessory =
    /\b(tablet|ipad|iphone|celular|smartphone|funda|cover|protector|estuche|galaxy\s+tab|tab)\b/.test(haystack);
  const isCameraContext = /\b(camara|camera|cctv|ip cam)\b/.test(haystack);
  const isLikelyCpuProduct = hasCpuSignature && !isCpuCoolerProduct;

  if (/\b(motherboard|mother|placa madre|placas madre|mainboard|chipset)\b/.test(haystack)) return "motherboard";
  if (/\b(ram|memoria|memorias|ddr[345])\b/.test(haystack)) return "ram";
  if (/\b(monitor|monitores|pantalla|display)\b/.test(haystack) && !isCameraContext) return "monitor";
  if (/\b(gpu|placa de video|grafica|rtx|gtx|radeon|geforce|arc)\b/.test(haystack)) return "gpu";
  if (/\b(ssd|hdd|storage|almacenamiento|nvme|m\.2|disco)\b/.test(haystack)) return "storage";
  const hasCabinetWord = /\b(gabinete|gabinetes|chassis|tower)\b/.test(haystack);
  const hasCaseWord = /\bcase\b/.test(haystack);
  const hasCasePcContext =
    hasCaseWord && /\b(atx|m-atx|matx|e-atx|itx|mini-itx|micro-atx|mid tower|full tower|pc)\b/.test(haystack);
  const hasCaseContext = hasCabinetWord || hasCasePcContext;
  const hasCaseLeadInName = /^(gabinete|gabinetes|case|chassis|tower)\b/.test(normalizedDisplayName);
  const hasCaseKitContext =
    /\bkit[a-z0-9]*\b/.test(haystack) &&
    /\b(gabinete|gabinetes|case|chassis|tower|atx|matx|itx)\b/.test(haystack);

  if (isLikelyCpuProduct || hasCpuWithoutCoolerPhrase) return "cpu";
  if (
    (isCpuCoolerProduct || (hasFanCoolingContext && !hasCaseLeadInName && !hasPowerSupplyContext)) &&
    !isClearlyNonCoolerAccessory
  ) {
    return "cooler";
  }
  if (hasPowerSupplyContext && !hasCaseLeadInName && !hasCaseKitContext && !isClearlyNonPsuContext) return "psu";
  if ((hasCaseContext || hasCaseLeadInName || hasCaseKitContext) && (!isClearlyNonCaseAccessory || hasCaseKitContext)) return "case";

  return null;
}

export function getMissingCriticalSpecs(type: PcComponentType, specs: PcSpecsNormalized): PcCanonicalSpecKey[] {
  return PC_CRITICAL_KEYS_BY_COMPONENT[type].filter((key) => !hasCriticalValue(key, specs));
}

export function buildCanonicalPreview(
  product: Pick<Product, "specs" | "name" | "name_custom" | "name_original" | "category" | "brand_name">,
): PcCanonicalPreviewItem[] {
  const specs = getProductSpecsRecord(product);
  const items: PcCanonicalPreviewItem[] = [];

  // 1. Explicitly mapped from raw specs
  for (const [rawKey, rawValue] of Object.entries(specs)) {
    if (rawValue === null || rawValue === undefined) continue;
    const canonicalKey = mapRawKeyToCanonical(rawKey);
    if (!canonicalKey) continue;
    const rawValueText = Array.isArray(rawValue)
      ? rawValue.map((item) => String(item)).join(", ")
      : String(rawValue);
    if (!rawValueText.trim()) continue;

    const normalizedSpecs = extractPcSpecs({ specs: { [rawKey]: rawValueText } as Record<string, string> });
    const normalizedValue = (() => {
      const value = normalizedSpecs[canonicalKey];
      if (Array.isArray(value)) return value.join(", ");
      if (typeof value === "number") return String(value);
      return value ?? rawValueText;
    })();

    items.push({
      rawKey,
      canonicalKey,
      rawValue: rawValueText,
      normalizedValue: String(normalizedValue),
    });
  }

  // 2. Inferred from text (IA) for missing keys
  const fullSpecs = extractPcSpecs(product);
  PC_CANONICAL_KEYS.forEach((key) => {
    const alreadyFound = items.some((item) => item.canonicalKey === key);
    if (!alreadyFound) {
      const val = fullSpecs[key];
      if (val !== undefined) {
        let textVal = "";
        if (Array.isArray(val)) textVal = val.join(", ");
        else if (typeof val === "number") textVal = String(val);
        else textVal = String(val);

        if (textVal && textVal.trim()) {
          items.push({
            rawKey: "(IA) Nombre/Desc",
            canonicalKey: key,
            rawValue: "IA",
            normalizedValue: textVal.trim(),
          });
        }
      }
    }
  });

  return items;
}

export function buildPcCatalogEntries(
  products: Product[],
  options: PcCatalogBuildOptions = {},
): PcCatalogEntry[] {
  const {
    includeInactive = false,
    includeUnknownType = false,
    includeOutOfStock = false,
  } = options;

  return products
    .filter((product) => {
      if (!includeInactive && product.active === false) return false;
      if (!includeOutOfStock && (product.stock ?? 0) <= 0) return false;
      return true;
    })
    .map((product) => {
      const componentType = inferPcComponentType(product);
      const specs = extractPcSpecs(product);
      const missingCritical = componentType ? getMissingCriticalSpecs(componentType, specs) : [];
      const eligible =
        componentType !== null &&
        missingCritical.length === 0 &&
        !isExcludedFromPcBuilder(componentType, specs, product);

      return {
        product,
        componentType,
        specs,
        missingCritical,
        eligible,
        canonicalPreview: buildCanonicalPreview(product),
      };
    })
    .filter((entry) => includeUnknownType || entry.componentType !== null)
    .sort((left, right) => {
      const leftType = left.componentType ? PC_COMPONENT_ORDER.indexOf(left.componentType) : Number.MAX_SAFE_INTEGER;
      const rightType = right.componentType ? PC_COMPONENT_ORDER.indexOf(right.componentType) : Number.MAX_SAFE_INTEGER;
      if (leftType !== rightType) return leftType - rightType;
      const leftName = left.product.name_custom?.trim() || left.product.name_original?.trim() || left.product.name;
      const rightName = right.product.name_custom?.trim() || right.product.name_original?.trim() || right.product.name;
      return leftName.localeCompare(rightName, "es-AR");
    });
}

export interface PcCompatibilityOptions {
  quantities?: Partial<Record<PcComponentType, number>>;
  goal?: PcBuildGoal;
}

export function evaluatePcCompatibility(
  selected: Partial<Record<PcComponentType, PcCatalogEntry>>,
  options: PcCompatibilityOptions = {},
): CompatibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const quantities = options.quantities ?? {};
  const goal = options.goal ?? "workstation";

  const cpu = selected.cpu;
  const motherboard = selected.motherboard;
  const ram = selected.ram;
  const gpu = selected.gpu;
  const storage = selected.storage;
  const storageSecondary = selected.storage_secondary;
  const psu = selected.psu;
  const pcCase = selected.case;
  const cooler = selected.cooler;

  if (cpu && motherboard) {
    const cpuSocket = cpu.specs.socket;
    const mbSocket = motherboard.specs.socket;
    if (cpuSocket && mbSocket && cpuSocket !== mbSocket) {
      reasons.push(`Socket incompatible entre CPU (${cpuSocket}) y motherboard (${mbSocket}).`);
    }

    const cpuBrand = normalizeToken(cpu.specs.platform_brand);
    const mbBrand = normalizeToken(motherboard.specs.platform_brand);
    if (cpuBrand && mbBrand && cpuBrand !== mbBrand) {
      reasons.push(`Conflicto de plataforma: CPU es ${cpu.specs.platform_brand} y Motherboard es ${motherboard.specs.platform_brand}.`);
    }

    const cpuGeneration = cpu.specs.cpu_generation;
    const chipsetCpuGenMax = motherboard.specs.mb_cpu_gen_max;
    const biosReadyGen = motherboard.specs.mb_bios_cpu_gen_ready;
    if (cpuGeneration && chipsetCpuGenMax && cpuGeneration > chipsetCpuGenMax) {
      reasons.push(`Chipset incompatible: CPU generación ${cpuGeneration} supera el máximo soportado (${chipsetCpuGenMax}).`);
    }
    if (cpuGeneration && biosReadyGen && cpuGeneration > biosReadyGen) {
      warnings.push(`La CPU generación ${cpuGeneration} puede requerir update de BIOS (actual: gen ${biosReadyGen}).`);
    }
  }

  if (motherboard && ram) {
    const mbMemory = normalizeToken(motherboard.specs.memory_type);
    const ramMemory = normalizeToken(ram.specs.memory_type);
    if (mbMemory && ramMemory && mbMemory !== ramMemory) {
      reasons.push(`RAM incompatible: la motherboard requiere ${motherboard.specs.memory_type}.`);
    }

    const mbFormFactors = motherboard.specs.form_factor ?? [];
    const ramFormFactors = ram.specs.form_factor ?? [];
    const motherboardIsDesktop = mbFormFactors.some((factor) =>
      ["atx", "matx", "mini-itx", "e-atx"].includes(normalizeToken(factor)),
    );
    const ramIsSodimm = ramFormFactors.some((factor) => normalizeToken(factor).includes("so-dimm"));
    if (motherboardIsDesktop && ramIsSodimm) {
      reasons.push("RAM incompatible: la motherboard usa módulos DIMM de escritorio (no SO-DIMM).");
    }
    const ramSpeed = ram.specs.ram_speed_mts;
    const maxRamSpeed = motherboard.specs.mb_max_ram_speed_mts;
    if (ramSpeed && maxRamSpeed && ramSpeed > maxRamSpeed) {
      reasons.push(`RAM fuera de rango: ${ramSpeed} MT/s supera el máximo de motherboard (${maxRamSpeed} MT/s).`);
    }

    const ramProfiles = ram.specs.ram_profiles ?? [];
    const motherboardProfiles = motherboard.specs.mb_ram_profiles ?? [];
    if (ramProfiles.length > 0 && motherboardProfiles.length > 0) {
      const mbSet = motherboardProfiles.map((value) => normalizeToken(value));
      const overlap = ramProfiles.some((value) => mbSet.includes(normalizeToken(value)));
      if (!overlap) {
        reasons.push(`Perfiles de RAM incompatibles (${ramProfiles.join(", ")}) con motherboard (${motherboardProfiles.join(", ")}).`);
      }
    }
  }

  if (motherboard && storage) {
    if (!interfaceOverlap(motherboard.specs.interface, storage.specs.interface)) {
      reasons.push("La interfaz del almacenamiento principal no coincide con la motherboard.");
    }
  }

  if (motherboard && storageSecondary) {
    if (!interfaceOverlap(motherboard.specs.interface, storageSecondary.specs.interface)) {
      reasons.push("La interfaz del almacenamiento secundario no coincide con la motherboard.");
    }
  }

  if (motherboard && gpu) {
    if (!interfaceOverlap(motherboard.specs.interface, gpu.specs.interface)) {
      reasons.push("La interfaz de GPU no coincide con los slots de la motherboard.");
    }
  }

  if (motherboard && pcCase) {
    const mbFormFactors = motherboard.specs.form_factor ?? [];
    const caseFormFactors = pcCase.specs.form_factor ?? [];
    if (
      mbFormFactors.length > 0 &&
      caseFormFactors.length > 0 &&
      !mbFormFactors.some((factor) => caseFormFactors.includes(factor))
    ) {
      const mbList = mbFormFactors.join(", ");
      const caseList = caseFormFactors.join(", ");
      reasons.push(`El gabinete (${caseList}) no soporta el tamaño de la motherboard (${mbList}).`);
    }
  }

  if (cpu && cooler) {
    const cpuSocket = cpu.specs.socket;
    const coolerSockets = cooler.specs.socket_supported ?? [];
    if (cpuSocket && coolerSockets.length > 0 && !coolerSockets.includes(cpuSocket)) {
      reasons.push(`El cooler no soporta el socket ${cpuSocket}.`);
    }

    const cpuTdp = cpu.specs.tdp_w;
    const gpuTdp = gpu?.specs.tdp_w;
    const coolerCapacity = cooler.specs.cooler_tdp_w;
    if (cpuTdp && coolerCapacity && cpuTdp > coolerCapacity) {
      reasons.push(`Capacidad térmica insuficiente: CPU ${cpuTdp}W supera cooler ${coolerCapacity}W.`);
    }
    if ((cooler.specs.cooler_type === "aio" || cooler.specs.cooler_type === "air") && coolerCapacity) {
      const totalThermalLoad = (cpuTdp ?? 0) + (gpuTdp ?? 0);
      if (totalThermalLoad > 0 && totalThermalLoad > coolerCapacity) {
        reasons.push(`Disipación insuficiente: carga térmica ${totalThermalLoad}W supera cooler ${coolerCapacity}W.`);
      } else if (totalThermalLoad > 0 && totalThermalLoad > coolerCapacity * 0.9) {
        warnings.push(`Carga térmica alta: ${totalThermalLoad}W sobre ${coolerCapacity}W de capacidad del cooler.`);
      }
    }
  }

  if (gpu && pcCase) {
    const gpuLength = gpu.specs.gpu_length_mm;
    const caseLimit = pcCase.specs.case_gpu_max_mm;
    if (
      Number.isFinite(gpuLength) &&
      Number.isFinite(caseLimit) &&
      gpuLength !== undefined &&
      caseLimit !== undefined &&
      gpuLength > caseLimit
    ) {
      reasons.push(`La GPU (${gpuLength} mm) supera el máximo del gabinete (${caseLimit} mm).`);
    }
    const gpuSlots = gpu.specs.gpu_thickness_slots;
    const caseSlotLimit = pcCase.specs.case_gpu_max_slots;
    if (gpuSlots && caseSlotLimit && gpuSlots > caseSlotLimit) {
      reasons.push(`La GPU ocupa ${gpuSlots} slots y el gabinete soporta hasta ${caseSlotLimit} slots.`);
    }
  }

  if (cooler && pcCase) {
    const coolerHeight = cooler.specs.cooler_height_mm;
    const caseCoolerMax = pcCase.specs.case_cooler_max_mm;
    if (coolerHeight && caseCoolerMax && coolerHeight > caseCoolerMax) {
      reasons.push(`El cooler (${coolerHeight} mm) supera la altura máxima del gabinete (${caseCoolerMax} mm).`);
    }

    const coolerType = cooler.specs.cooler_type;
    const radiatorSize = cooler.specs.radiator_size_mm;
    const caseRadiatorLimit = pcCase.specs.case_radiator_max_mm;
    if (coolerType === "aio" && radiatorSize && caseRadiatorLimit && radiatorSize > caseRadiatorLimit) {
      reasons.push(`El radiador (${radiatorSize} mm) supera el máximo del gabinete (${caseRadiatorLimit} mm).`);
    }
  }

  if (psu && (cpu || gpu)) {
    const available = psu.specs.wattage;
    const recommended = estimatePsuRequirement(cpu?.specs.tdp_w, gpu?.specs.tdp_w, goal);
    if (available && available < recommended) {
      reasons.push(`Fuente insuficiente: ${available}W (recomendado ${recommended}W).`);
    }
  }

  if (motherboard) {
    const storagePrimaryQty = Math.max(1, Number(quantities.storage ?? (storage ? 1 : 0)));
    const storageSecondaryQty = Math.max(1, Number(quantities.storage_secondary ?? (storageSecondary ? 1 : 0)));
    const sataPorts = motherboard.specs.mb_sata_ports;
    const m2Slots = motherboard.specs.mb_m2_slots;
    const sataDisabledPerM2 = motherboard.specs.mb_sata_ports_disabled_with_m2 ?? 0;
    const pcieX16Slots = motherboard.specs.mb_pcie_x16_slots;

    const allStorageEntries = [
      { interfaces: storage?.specs.interface ?? [], qty: storage ? storagePrimaryQty : 0 },
      { interfaces: storageSecondary?.specs.interface ?? [], qty: storageSecondary ? storageSecondaryQty : 0 },
    ];

    const m2OrNvmeUnits = allStorageEntries.reduce((sum, item) => {
      const normalized = item.interfaces.map((value) => normalizeToken(value));
      if (normalized.some((value) => value.includes("m.2") || value.includes("nvme"))) return sum + item.qty;
      return sum;
    }, 0);
    const sataUnits = allStorageEntries.reduce((sum, item) => {
      const normalized = item.interfaces.map((value) => normalizeToken(value));
      if (normalized.some((value) => value.includes("sata"))) return sum + item.qty;
      return sum;
    }, 0);

    if (m2Slots && m2OrNvmeUnits > m2Slots) {
      reasons.push(`Exceso de unidades M.2/NVMe (${m2OrNvmeUnits}) para la motherboard (${m2Slots} slots).`);
    }

    const effectiveSataPorts =
      sataPorts && sataDisabledPerM2 > 0
        ? Math.max(0, sataPorts - Math.min(m2OrNvmeUnits, m2Slots ?? m2OrNvmeUnits) * sataDisabledPerM2)
        : sataPorts;
    if (effectiveSataPorts && sataUnits > effectiveSataPorts) {
      reasons.push(`Conflicto de puertos SATA: ${sataUnits} unidades para ${effectiveSataPorts} puertos disponibles.`);
    }

    if (gpu && pcieX16Slots && pcieX16Slots < 1) {
      reasons.push("La motherboard no tiene slot PCIe x16 disponible para la GPU.");
    }
    if (gpu && !pcieX16Slots) {
      warnings.push("No hay dato de slots PCIe x16 en motherboard para validar GPU.");
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons: uniq(reasons),
    warnings: uniq(warnings),
  };
}
