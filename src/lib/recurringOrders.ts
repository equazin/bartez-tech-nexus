export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "custom";
export type RecurringMode = "auto" | "confirm";

export interface RecurringOrderItem {
  product_id: number;
  quantity: number;
}

export interface RecurringOrderTemplate {
  id: string;
  profile_id: string;
  company_id: string | null;
  name: string;
  items: RecurringOrderItem[];
  frequency: RecurringFrequency;
  custom_days: number | null;
  next_run_at: string;
  mode: RecurringMode;
  active: boolean;
  created_at: string;
}

export function formatRecurringFrequency(
  frequency: RecurringFrequency,
  customDays?: number | null,
): string {
  switch (frequency) {
    case "weekly":
      return "Semanal";
    case "biweekly":
      return "Quincenal";
    case "monthly":
      return "Mensual";
    case "custom":
      return customDays && customDays > 0 ? `Cada ${customDays} dias` : "Personalizada";
    default:
      return "Personalizada";
  }
}

function addSchedule(base: Date, frequency: RecurringFrequency, customDays?: number | null) {
  const next = new Date(base);

  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "custom":
      next.setDate(next.getDate() + Math.max(1, customDays ?? 1));
      break;
  }

  return next;
}

export function computeNextRecurringRun(
  baseDate: string | Date,
  frequency: RecurringFrequency,
  customDays?: number | null,
  referenceDate?: Date,
): string {
  const reference = referenceDate ?? new Date();
  let cursor = typeof baseDate === "string" ? new Date(baseDate) : new Date(baseDate);

  if (Number.isNaN(cursor.getTime())) {
    cursor = new Date(reference);
  }

  if (cursor > reference) {
    return cursor.toISOString();
  }

  while (cursor <= reference) {
    cursor = addSchedule(cursor, frequency, customDays);
  }

  return cursor.toISOString();
}
