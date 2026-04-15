export type PcBuilderMode = "guided" | "manual";
export type PcBuilderGoal = "office" | "gaming" | "workstation";
export type PcBuilderPriority = "price" | "balanced" | "performance";
export type PcBuilderCurrency = "ARS" | "USD";

export type PcBuildSlotKey =
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

export type PcBuildCompatibilityState = "compatible" | "incompatible" | "incomplete" | "unknown";

export interface PcBuildItemDraft {
  slotKey: PcBuildSlotKey;
  productId: number;
  quantity: number;
  compatibilityState: PcBuildCompatibilityState;
  locked?: boolean;
  notes?: string;
}

export interface PcBuildDraft {
  id: string;
  clientId: string;
  name: string;
  mode: PcBuilderMode;
  goal?: PcBuilderGoal;
  budgetMin?: number;
  budgetMax?: number;
  currency: PcBuilderCurrency;
  priority?: PcBuilderPriority;
  status: "draft" | "quoted" | "ordered";
  items: PcBuildItemDraft[];
  createdAt: string;
  updatedAt: string;
}

export interface SavePcBuildDraftInput {
  id?: string;
  name: string;
  mode: PcBuilderMode;
  goal?: PcBuilderGoal;
  budgetMin?: number;
  budgetMax?: number;
  currency: PcBuilderCurrency;
  priority?: PcBuilderPriority;
  status?: "draft" | "quoted" | "ordered";
  items: PcBuildItemDraft[];
}
