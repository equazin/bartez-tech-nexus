import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { abrirFacturaDelPanel, listarComprasParaFacturar, subirFactura, type CompraParaFacturar } from "@/lib/api/cuentaPanel";

const ESTADOS: Record<string, string> = {
  pagado: "Pagado",
  preparando: "Preparando",
  enviado: "Enviado",
  entregado: "Entregado",
  reintegrado: "Reintegrado",
};

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

/**
 * Pagos › Facturas de la tienda: la factura B se hace con el sistema de siempre y acá se sube el PDF. Queda en la
 * compra y en Mi cuenta, y le llega al comprador por email con el PDF adjunto.
 */
export function FacturasTienda() {
  const [compras, setCompras] = useState<CompraParaFacturar[] | null>(null);
  const [filtro, setFiltro] = useState<"pendientes" | "todas">("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const elegirArchivo = useRef<HTMLInputElement>(null);
  const destino = useRef<number | null>(null);

  async function cargar() {
    try {
      setCompras(await listarComprasParaFacturar());
    } catch (e: unknown) {
      setCompras([]);
      toast.error(e instanceof Error ? e.message : "No se pudieron leer las compras.");
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return (compras ?? [])
      .filter((c) => filtro === "todas" || !c.factura)
      .filter((c) => !termino || [c.order_number, c.comprador_nombre, c.comprador_email, c.comprador_documento].some((v) => v?.toLowerCase().includes(termino)));
  }, [compras, filtro, busqueda]);

  function pedirArchivo(orderId: number) {
    destino.current = orderId;
    elegirArchivo.current?.click();
  }

  async function alElegir(archivo: File | undefined) {
    const orderId = destino.current;
    if (elegirArchivo.current) elegirArchivo.current.value = "";
    if (!archivo || !orderId) return;
    setSubiendo(orderId);
    try {
      const r = await subirFactura(orderId, archivo);
      toast.success(r.email_enviado ? "Factura guardada y enviada al comprador." : "Factura guardada. El email no salió: revisá el correo de la tienda.");
      await cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la factura.");
    } finally {
      setSubiendo(null);
      destino.current = null;
    }
  }

  async function ver(orderId: number) {
    try {
      await abrirFacturaDelPanel(orderId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir la factura.");
    }
  }

  const pendientes = (compras ?? []).filter((c) => !c.factura).length;

  return (
    <SurfaceCard className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Facturas de la tienda</h2>
          <p className="text-sm text-muted-foreground">
            Subí el PDF de la factura de cada compra paga. Queda en la compra y en Mi cuenta del cliente, y le llega por email adjunta. Si subís otra,
            reemplaza a la anterior y se vuelve a mandar.
          </p>
        </div>
        <Badge variant={pendientes > 0 ? "warning" : "success"}>{compras === null ? "Cargando" : `${pendientes} sin factura`}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filtro === "pendientes" ? "default" : "outline"} onClick={() => setFiltro("pendientes")}>
          Sin factura
        </Button>
        <Button size="sm" variant={filtro === "todas" ? "default" : "outline"} onClick={() => setFiltro("todas")}>
          Todas
        </Button>
        <Input className="h-9 max-w-xs" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Número, nombre, email o DNI" />
      </div>
      <input ref={elegirArchivo} type="file" accept="application/pdf" className="hidden" onChange={(e) => void alElegir(e.target.files?.[0])} />
      {compras !== null && visibles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{filtro === "pendientes" ? "No hay compras pagas sin factura." : "No hay compras con ese dato."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {visibles.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-[220px] flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{c.order_number}</span>
                  <Badge variant="outline">{ESTADOS[c.status] ?? c.status}</Badge>
                  {c.factura && <Badge variant="success">Factura subida{c.factura_subida_en ? ` el ${fecha.format(new Date(c.factura_subida_en))}` : ""}</Badge>}
                </div>
                <div>
                  {c.comprador_nombre ?? "Sin nombre"} · {c.comprador_documento ? `DNI/CUIT ${c.comprador_documento}` : "sin DNI"} · {pesos.format(Number(c.total))}
                </div>
                <div className="text-muted-foreground">
                  {c.comprador_email} · {fecha.format(new Date(c.pagado_en ?? c.created_at))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={c.factura ? "outline" : "default"} onClick={() => pedirArchivo(c.id)} disabled={subiendo !== null}>
                  {subiendo === c.id ? "Subiendo" : c.factura ? "Reemplazar PDF" : "Subir factura (PDF)"}
                </Button>
                {c.factura && (
                  <Button size="sm" variant="ghost" onClick={() => void ver(c.id)}>
                    Ver
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}
