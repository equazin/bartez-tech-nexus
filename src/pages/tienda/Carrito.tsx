import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { Precio } from "@/components/tienda/Precio";
import { cambiarCantidad, quitarDelCarrito } from "@/lib/tienda/carrito";
import { useCarritoDetallado } from "@/lib/tienda/carritoDetallado";
import { imagenPrincipal, rutaDelProducto } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { cotizarEnvio, textoDeDemora, type CotizacionDeEnvio } from "@/lib/tienda/envios";
import { useSeo } from "@/lib/tienda/seo";

export default function Carrito() {
  useSeo("Carrito");
  const { lineas, subtotal, pesoKg, cargando, problemas, listoParaComprar } = useCarritoDetallado();
  const [envio, setEnvio] = useState<CotizacionDeEnvio | null>(null);

  useEffect(() => {
    if (lineas.length === 0 || cargando) {
      setEnvio(null);
      return;
    }
    let cancelado = false;
    cotizarEnvio(pesoKg, subtotal)
      .then((c) => {
        if (!cancelado) setEnvio(c);
      })
      .catch(() => {
        if (!cancelado) setEnvio(null);
      });
    return () => {
      cancelado = true;
    };
  }, [lineas.length, cargando, pesoKg, subtotal]);

  if (lineas.length === 0) {
    return (
      <Tienda>
        <div className="container mx-auto flex flex-col items-start gap-4 px-4 py-24">
          <h1 className="text-[28px] font-bold leading-[34px]">Tu carrito está vacío</h1>
          <p className="text-muted-foreground">Cuando agregues productos, van a aparecer acá.</p>
          <Button asChild>
            <Link to="/">Ver la tienda</Link>
          </Button>
        </div>
      </Tienda>
    );
  }

  const costoEnvio = envio?.disponible ? (envio.precio ?? 0) : null;
  const total = subtotal + (costoEnvio ?? 0);

  return (
    <Tienda>
      <div className="container mx-auto grid gap-8 px-4 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="space-y-4">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">Carrito</h1>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {lineas.map(({ linea, producto }) => (
              <li key={linea.productoId} className="flex gap-4 p-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-placa-foto p-2">
                  {producto && imagenPrincipal(producto) && (
                    <img src={imagenPrincipal(producto) ?? ""} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {producto ? (
                    <Link to={rutaDelProducto(producto)} className="font-medium leading-snug hover:underline">
                      {producto.nombre}
                    </Link>
                  ) : (
                    <p className="font-medium text-muted-foreground">{cargando ? "Cargando" : "Este producto ya no está en la tienda"}</p>
                  )}
                  {producto && !producto.hay_stock && <p className="text-sm text-danger">Sin stock: sacalo del carrito para seguir.</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-xl border border-input">
                      <button
                        type="button"
                        aria-label="Una unidad menos"
                        onClick={() => cambiarCantidad(linea.productoId, linea.cantidad - 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-l-xl hover:bg-secondary"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold tabular-nums">{linea.cantidad}</span>
                      <button
                        type="button"
                        aria-label="Una unidad más"
                        onClick={() => cambiarCantidad(linea.productoId, linea.cantidad + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-r-xl hover:bg-secondary"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {producto && <Precio precioFinal={producto.precio_final_ars !== null ? producto.precio_final_ars * linea.cantidad : null} />}
                      <Button variant="ghost" size="icon" aria-label="Quitar del carrito" onClick={() => quitarDelCarrito(linea.productoId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-[20px] font-bold leading-[26px]">Resumen</h2>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatearPesos(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Envío a todo el país</span>
              <span className="tabular-nums">
                {envio === null ? "Cotizando" : !envio.disponible ? "A confirmar" : envio.gratis ? "Sin cargo" : formatearPesos(envio.precio ?? 0)}
              </span>
            </div>
            {envio?.disponible && <p className="text-xs text-muted-foreground">{textoDeDemora(envio)} desde que se acredita el pago, en cualquier provincia.</p>}
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatearPesos(total)}</span>
            </div>
            <Precio precioFinal={total} conCuotas className="[&>span]:hidden" />
            {problemas.length > 0 && (
              <ul className="space-y-1 rounded-xl bg-error-fondo p-3 text-sm text-danger">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <Button asChild size="lg" className="w-full" disabled={!listoParaComprar}>
              <Link to={listoParaComprar ? "/checkout" : "#"} aria-disabled={!listoParaComprar}>
                Iniciar la compra
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">Sin registro. Precios finales con IVA incluido.</p>
          </div>
        </aside>
      </div>
    </Tienda>
  );
}
