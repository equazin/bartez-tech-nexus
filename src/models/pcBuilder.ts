import type { Product } from "@/models/products";

export type BuilderMode = "guided" | "manual";
export type BuilderGoal = "office" | "gaming" | "workstation";
export type BuilderPriority = "price" | "balanced" | "performance";
export type BuilderCurrency = "ARS" | "USD";

export type BuilderSlotKey =
  | "cpu"
  | "motherboard"
  | "ram"
  | "storage"
  | "gpu"
  | "psu"
  | "case"
  | "monitor";

export type CompatibilitySeverity = "error" | "warning" | "info";
export type CompatibilityState = "compatible" | "incompatible" | "incomplete" | "unknown";

export interface CompatibilityIssue {
  id: string;
  severity: CompatibilitySeverity;
  title: string;
  description: string;
  action?: string;
  slotKeys: BuilderSlotKey[];
}

export interface SelectedBuilderItem {
  product: Product;
  quantity: number;
}

export type SelectedBuilderItems = Partial<Record<BuilderSlotKey, SelectedBuilderItem>>;

export interface BuilderSlotConfig {
  key: BuilderSlotKey;
  label: string;
  required: boolean;
}

export interface CandidateCompatibility {
  state: CompatibilityState;
  reason?: string;
}

export interface BuildCompatibilityResult {
  state: CompatibilityState;
  canFinalize: boolean;
  issues: CompatibilityIssue[];
  missingRequiredSlots: BuilderSlotKey[];
  estimatedPowerW: number;
  recommendedPsuW: number;
}

export interface PcBuildItemDraft {
  slotKey: BuilderSlotKey;
  productId: number;
  quantity: number;
  locked: boolean;
  compatibilityState: CompatibilityState;
  notes?: string;
}

export interface PcBuildDraft {
  id: string;
  clientId: string;
  name: string;
  mode: BuilderMode;
  goal?: BuilderGoal;
  budgetMin?: number;
  budgetMax?: number;
  currency: BuilderCurrency;
  priority?: BuilderPriority;
  status: "draft" | "quoted" | "ordered";
  items: PcBuildItemDraft[];
  createdAt: string;
  updatedAt: string;
}

export interface SavePcBuildDraftInput {
  id?: string;
  name: string;
  mode: BuilderMode;
  goal?: BuilderGoal;
  budgetMin?: number;
  budgetMax?: number;
  currency: BuilderCurrency;
  priority?: BuilderPriority;
  status?: "draft" | "quoted" | "ordered";
  items: PcBuildItemDraft[];
}

export const BUILDER_SLOT_CONFIG: BuilderSlotConfig[] = [
  { key: "cpu", label: "CPU", required: true },
  { key: "motherboard", label: "Motherboard", required: true },
  { key: "ram", label: "RAM", required: true },
  { key: "storage", label: "Almacenamiento", required: true },
  { key: "gpu", label: "GPU", required: false },
  { key: "psu", label: "Fuente (PSU)", required: true },
  { key: "case", label: "Gabinete", required: true },
  { key: "monitor", label: "Monitor", required: true },
];

export const BUILDER_REQUIRED_SLOTS = BUILDER_SLOT_CONFIG.filter((slot) => slot.required).map((slot) => slot.key);
