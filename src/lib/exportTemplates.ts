import { supabase } from "@/lib/supabase";
import type { PriceListRow } from "@/components/portal/catalog/types";

export type ExportColumnKey = keyof PriceListRow;

export interface ExportTemplateColumn {
  key: ExportColumnKey;
  label: string;
}

export interface ExportTemplateFilters {
  drop_zero_stock?: boolean;
  drop_zero_price?: boolean;
}

export type ExportTemplateFormat = "csv" | "xlsx";

export interface ExportTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  format: ExportTemplateFormat;
  columns: ExportTemplateColumn[];
  filters: ExportTemplateFilters;
  filename_pattern: string;
}

interface RawTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  format: string;
  columns: unknown;
  filters: unknown;
  filename_pattern: string;
}

function parseTemplate(raw: RawTemplate): ExportTemplate {
  const columns = Array.isArray(raw.columns) ? (raw.columns as ExportTemplateColumn[]) : [];
  const filters = raw.filters && typeof raw.filters === "object"
    ? (raw.filters as ExportTemplateFilters)
    : {};
  const format: ExportTemplateFormat = raw.format === "xlsx" ? "xlsx" : "csv";
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    format,
    columns,
    filters,
    filename_pattern: raw.filename_pattern,
  };
}

export async function fetchExportTemplates(): Promise<ExportTemplate[]> {
  const { data, error } = await supabase
    .from("client_export_templates")
    .select("id, slug, name, description, format, columns, filters, filename_pattern")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => parseTemplate(row as RawTemplate));
}

export interface ExportTemplateWithMeta extends ExportTemplate {
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface RawTemplateWithMeta extends RawTemplate {
  active: boolean;
  created_at: string;
  updated_at: string;
}

function parseTemplateWithMeta(raw: RawTemplateWithMeta): ExportTemplateWithMeta {
  return {
    ...parseTemplate(raw),
    active: Boolean(raw.active),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export async function fetchAllExportTemplates(): Promise<ExportTemplateWithMeta[]> {
  const { data, error } = await supabase
    .from("client_export_templates")
    .select("id, slug, name, description, format, columns, filters, filename_pattern, active, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => parseTemplateWithMeta(row as RawTemplateWithMeta));
}

export interface ExportTemplateInput {
  slug: string;
  name: string;
  description?: string | null;
  format: ExportTemplateFormat;
  columns: ExportTemplateColumn[];
  filters: ExportTemplateFilters;
  filename_pattern: string;
  active?: boolean;
}

export async function createExportTemplate(input: ExportTemplateInput): Promise<ExportTemplateWithMeta> {
  const { data, error } = await supabase
    .from("client_export_templates")
    .insert({
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      format: input.format,
      columns: input.columns,
      filters: input.filters,
      filename_pattern: input.filename_pattern,
      active: input.active ?? true,
    })
    .select("id, slug, name, description, format, columns, filters, filename_pattern, active, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return parseTemplateWithMeta(data as RawTemplateWithMeta);
}

export async function updateExportTemplate(
  id: string,
  patch: Partial<ExportTemplateInput>,
): Promise<ExportTemplateWithMeta> {
  const { data, error } = await supabase
    .from("client_export_templates")
    .update(patch)
    .eq("id", id)
    .select("id, slug, name, description, format, columns, filters, filename_pattern, active, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return parseTemplateWithMeta(data as RawTemplateWithMeta);
}

export async function deleteExportTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("client_export_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export const AVAILABLE_COLUMN_KEYS: ExportColumnKey[] = [
  "sku",
  "name",
  "brand_name",
  "category",
  "unit_price",
  "stock",
  "min_order_qty",
  "product_id",
];

export const COLUMN_DEFAULT_LABELS: Record<ExportColumnKey, string> = {
  product_id: "ID",
  sku: "SKU",
  name: "Nombre",
  brand_name: "Marca",
  category: "Categoría",
  unit_price: "Precio",
  stock: "Stock",
  min_order_qty: "Cant. mínima",
};

function todayLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveFilename(
  template: ExportTemplate,
  context: { clientName?: string } = {},
): string {
  const slug = (context.clientName ?? "cliente")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = template.filename_pattern
    .replace(/\{date\}/g, todayLabel())
    .replace(/\{client_name\}/g, slug || "cliente");
  const ext = template.format === "xlsx" ? ".xlsx" : ".csv";
  return `${base}${ext}`;
}

export function applyFilters(rows: PriceListRow[], filters: ExportTemplateFilters): PriceListRow[] {
  return rows.filter((row) => {
    if (filters.drop_zero_stock && row.stock <= 0) return false;
    if (filters.drop_zero_price && row.unit_price <= 0) return false;
    return true;
  });
}

export function projectRows(
  rows: PriceListRow[],
  columns: ExportTemplateColumn[],
): Record<string, string | number>[] {
  return rows.map((row) => {
    const projected: Record<string, string | number> = {};
    for (const col of columns) {
      const value = row[col.key];
      projected[col.label] = value as string | number;
    }
    return projected;
  });
}
