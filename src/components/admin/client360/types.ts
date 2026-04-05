export type Client360BadgeTone =
  | "success"
  | "warning"
  | "destructive"
  | "outline"
  | "muted";

export interface ExecutiveOption {
  id: string;
  name: string;
  role: string;
  email?: string | null;
}

export interface Client360Tag {
  label: string;
  tone: Client360BadgeTone;
}

export interface Client360Metric {
  id: "credit-available" | "credit-used" | "last-order" | "monthly-volume" | "purchase-variation" | "avg-ticket";
  label: string;
  value: string;
  detail?: string;
  trend?: string;
}

export interface Client360Alert {
  title: string;
  description: string;
  tone: Client360BadgeTone;
}

export interface ProductInsight {
  name: string;
  detail: string;
  value: string;
}

export interface PriorityAction {
  title: string;
  description: string;
  tone: Client360BadgeTone;
}

export interface TimelineItem {
  id: string;
  kind: "pedido" | "cotizacion" | "nota" | "actividad" | "ticket" | "rma";
  title: string;
  detail: string;
  at: string;
  relative: string;
  tone: Client360BadgeTone;
}

export interface SupportSummary {
  openTickets: number;
  activeRmas: number;
  slaLabel: string;
  slaTone: Client360BadgeTone;
  latestSubject?: string;
  latestUpdatedLabel?: string;
}
