import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePriceListExport } from "@/hooks/usePriceListExport";
import { useToast } from "@/hooks/use-toast";
import type { ExportTemplate } from "@/lib/exportTemplates";

interface Props {
  clientId: string | undefined;
  clientName?: string;
}

export function PriceListDownload({ clientId, clientName }: Props) {
  const { templates, templatesLoading, exportWithTemplate, loading, error } =
    usePriceListExport(clientId, clientName);
  const { toast } = useToast();

  async function handleExport(template: ExportTemplate) {
    await exportWithTemplate(template);
    if (error) {
      toast({ title: "Error al exportar", description: error, variant: "destructive" });
    } else {
      toast({
        title: "Lista descargada",
        description: `${template.name} (${template.format.toUpperCase()})`,
      });
    }
  }

  if (!clientId) return null;

  const disabled = loading || templatesLoading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="shrink-0 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Descargar lista</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {templates.length > 0 ? (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Elegir plantilla
            </DropdownMenuLabel>
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                onClick={() => handleExport(template)}
                disabled={loading}
                className="flex flex-col items-start gap-0.5 py-2"
              >
                <span className="text-sm">
                  {template.name}{" "}
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {template.format}
                  </span>
                </span>
                {template.description && (
                  <span className="text-xs text-muted-foreground leading-tight">
                    {template.description}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground">
              Las plantillas las configura el equipo de Bartez.
            </DropdownMenuLabel>
          </>
        ) : (
          <DropdownMenuItem disabled>
            {templatesLoading ? "Cargando plantillas..." : "No hay plantillas disponibles"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
