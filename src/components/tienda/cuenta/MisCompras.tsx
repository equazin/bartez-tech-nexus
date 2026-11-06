import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveProductImageUrl } from "@/lib/productImage";
import { enlaceDeFactura, misCompras, type CompraDeLaCuenta } from "@/lib/tienda/cuenta";
import { formatearPesos } from "@/lib/tienda/dinero";
import { etiquetaDeEstado } from "@/lib/tienda/pedidos";

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" });

function varianteDe(estado: string): "success" | "secondary" | "destructive" | "outline" {
  if (estado === "pagado" || estado === "entregado") return "success";
  if (estado === "cancelado" || estado === "vencido" || estado === "reintegrado") return "destructive";
  if (estado === "pendiente_pago") return "outline";
  return "secondary";
}

export function MisCompras() {
  const [compras, setCompras] = useState<CompraDeLaCuenta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    misCompras()
      .then(setCompras)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No pudimos cargar tus compras."));
  }, []);

  if (error) return <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{error}</p>;
  if (!compras) return <p className="text-sm text-muted-foreground">Cargando tus compras</p>;
  if (compras.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-border p-6">
        <p className="font-bold">Todavía no hay compras con este email</p>
        <p className="text-sm text-muted-foreground">Las compras que hagas con este email aparecen acá, con o sin la sesión abierta.</p>
        <Button asChild variant="outline">
          <Link to="/">Ver la tienda</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {compras.map((compra) => {
        const primero = compra.items[0];
        const resto = compra.items.length - 1;
        return (
          <li key={compra.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-placa-foto p-1">
              {primero?.imagen && <img src={resolveProductImageUrl(primero.imagen)} alt="" className="h-full w-full object-contain mix-blend-multiply" />}
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">Compra {compra.numero}</span>
                <Badge variant={varianteDe(compra.estado)}>{etiquetaDeEstado(compra.estado)}</Badge>
              </div>
              <p className="text-sm">
                {primero ? `${primero.cantidad} × ${primero.nombre}` : ""}
                {resto > 0 ? ` y ${resto} ${resto === 1 ? "producto más" : "productos más"}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatoFecha.format(new Date(compra.creado_en))} · <span className="tabular-nums">{formatearPesos(compra.total)}</span>
                {compra.seguimiento ? ` · Seguimiento ${compra.seguimiento}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={`/compra/${compra.id}?t=${encodeURIComponent(compra.token)}`}>Ver compra</a>
              </Button>
              {compra.seguimiento_url && (
                <Button asChild size="sm" variant="outline">
                  <a href={compra.seguimiento_url} target="_blank" rel="noreferrer">
                    Seguir el envío
                  </a>
                </Button>
              )}
              {compra.factura && (
                <Button asChild size="sm" variant="outline">
                  <a href={enlaceDeFactura(compra.id, compra.token)}>Factura</a>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
