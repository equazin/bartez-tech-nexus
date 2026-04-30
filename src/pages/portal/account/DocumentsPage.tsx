import { useState, useCallback } from "react";
import { FileText, Download, Filter, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useImpersonate } from "@/context/ImpersonateContext";
import { useClientDocuments, type DocumentKind } from "@/hooks/useClientDocuments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MoneyCell } from "@/components/ui/money-cell";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  draft:     "Borrador",
  sent:      "Enviada",
  paid:      "Pagada",
  overdue:   "Vencida",
  cancelled: "Cancelada",
  pending:   "Pendiente",
  approved:  "Aprobado",
  delivered: "Entregado",
  shipped:   "Enviado",
  dispatched:"Despachado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid:      "default",
  delivered: "default",
  sent:      "secondary",
  pending:   "secondary",
  approved:  "secondary",
  overdue:   "destructive",
  cancelled: "destructive",
};

export default function DocumentsPage() {
  const { profile: authProfile } = useAuth();
  const { activeProfile } = useImpersonate();
  const profile = activeProfile ?? authProfile;
  const clientId = profile?.id;

  const { documents, loading, filters, setFilters, clearFilters } = useClientDocuments(clientId);
  const hasFilters = filters.kind !== null || filters.from !== null || filters.to !== null || filters.status !== null;

  const handleDownload = useCallback((doc: { pdf_url: string | null; number: string }) => {
    if (!doc.pdf_url) return;
    const a = document.createElement("a");
    a.href = doc.pdf_url;
    a.download = `${doc.number}.pdf`;
    a.target = "_blank";
    a.click();
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Documentos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Facturas y remitos de los últimos 12 meses</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={filters.kind ?? "all"}
          onValueChange={(v) => setFilters({ kind: v === "all" ? null : v as DocumentKind })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="invoice">Facturas</SelectItem>
            <SelectItem value="remito">Remitos</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status ?? "all"}
          onValueChange={(v) => setFilters({ status: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="paid">Pagada</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="overdue">Vencida</SelectItem>
            <SelectItem value="delivered">Entregado</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilters({ from: e.target.value || null })}
            className="w-36 text-sm"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => setFilters({ to: e.target.value || null })}
            className="w-36 text-sm"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Limpiar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-left">Número</th>
              <th className="px-4 py-2.5 text-left">Tipo</th>
              <th className="hidden px-4 py-2.5 text-left sm:table-cell">Fecha</th>
              <th className="px-4 py-2.5 text-right">Importe</th>
              <th className="px-4 py-2.5 text-center">Estado</th>
              <th className="px-4 py-2.5 text-center">PDF</th>
            </tr>
          </thead>
          <tbody>
            {loading && documents.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {[1,2,3,4,5,6].map((j) => (
                      <td key={j} className="px-4 py-2.5">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : documents.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      {hasFilters ? "Sin resultados para los filtros aplicados." : "Sin documentos disponibles."}
                    </td>
                  </tr>
                )
                : documents.map((doc) => (
                  <tr key={doc.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{doc.number}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {doc.kind === "invoice" ? "Factura" : "Remito"}
                    </td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                      {new Date(doc.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <MoneyCell value={doc.amount} from={doc.currency as "ARS" | "USD"} emphasis="strong" />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={STATUS_VARIANT[doc.status] ?? "outline"}>
                        {STATUS_LABEL[doc.status] ?? doc.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {doc.pdf_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <FileText className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
