import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PriceListRow } from "@/components/portal/catalog/types";
import {
  applyFilters,
  fetchExportTemplates,
  projectRows,
  resolveFilename,
  type ExportTemplate,
} from "@/lib/exportTemplates";

function rowsToCsv(records: Record<string, string | number>[]): string {
  if (records.length === 0) return "";
  const headers = Object.keys(records[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const headerLine = headers.join(",");
  const dataLines = records.map((rec) => headers.map((h) => escape(rec[h])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchRows(clientId: string): Promise<PriceListRow[]> {
  const { data, error } = await supabase.rpc("get_price_list_for_client", {
    p_client_id: clientId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as PriceListRow[];
}

export function usePriceListExport(clientId: string | undefined, clientName?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    fetchExportTemplates()
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const exportWithTemplate = useCallback(
    async (template: ExportTemplate) => {
      if (!clientId) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchRows(clientId);
        const filtered = applyFilters(rows, template.filters);
        const projected = projectRows(filtered, template.columns);
        const filename = resolveFilename(template, { clientName });

        if (template.format === "xlsx") {
          const XLSX = await import("xlsx");
          const ws = XLSX.utils.json_to_sheet(projected);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, template.name.slice(0, 31));
          XLSX.writeFile(wb, filename);
        } else {
          const csv = rowsToCsv(projected);
          triggerDownload(
            new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
            filename,
          );
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error al exportar");
      } finally {
        setLoading(false);
      }
    },
    [clientId, clientName],
  );

  return {
    templates,
    templatesLoading,
    exportWithTemplate,
    loading,
    error,
  };
}
