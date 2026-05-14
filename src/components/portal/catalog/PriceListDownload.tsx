import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePriceListExport } from "@/hooks/usePriceListExport";
import { useToast } from "@/hooks/use-toast";

interface Props {
  clientId: string | undefined;
}

export function PriceListDownload({ clientId }: Props) {
  const { exportCsv, exportXlsx, loading, error } = usePriceListExport(clientId);
  const { toast } = useToast();

  async function handleCsv() {
    await exportCsv();
    if (error) toast({ title: "Error al exportar", description: error, variant: "destructive" });
    else toast({ title: "Lista descargada", description: "lista_precios.csv" });
  }

  async function handleXlsx() {
    await exportXlsx();
    if (error) toast({ title: "Error al exportar", description: error, variant: "destructive" });
    else toast({ title: "Lista descargada", description: "lista_precios.xlsx" });
  }

  if (!clientId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading} className="shrink-0 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Descargar lista</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCsv} disabled={loading}>
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleXlsx} disabled={loading}>
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
