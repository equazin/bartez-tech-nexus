import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { Tienda } from "@/components/tienda/Tienda";
import { Precio } from "@/components/tienda/Precio";
import { Bloque, EncabezadoDeSeccion } from "@/components/tienda/Seccion";
import { ChipsDeDatos, EstadoDeStock, GrillaProductos } from "@/components/tienda/TarjetaProducto";
import { cambiarCantidad, quitarDelCarrito } from "@/lib/tienda/carrito";
import { useCarritoDetallado } from "@/lib/tienda/carritoDetallado";
import { imagenPrincipal, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { cotizarEnvio, textoDeDemora, type CotizacionDeEnvio } from "@/lib/tienda/envios";
import { datosClave } from "@/lib/tienda/ficha";
import { complementosDe } from "@/lib/tienda/sugerencias";
import { usarSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

const PASOS = ["Carrito", "Tus datos", "Envío", "Pago"];

function Pasos() {
  return (
    <ol aria-label="Pasos de la compra" className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {PASOS.map((paso, i) => (
        <li
          key={paso}
          aria-current={i === 0 ? "step" : undefined}
          className={cn(
            "flex h-[52px] items-center gap-2.5 rounded-xl border bg-card px-3.5 text-[15px]",
            i === 0 ? "border-foreground font-bold" : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
              i === 0 ? "bg-primary text-primary-foreground" : "border border-input",
            )}
          >
            {i + 1}
          </span>
          {paso}
        </li>
      ))}
    </ol>
  );
}

type Medio = "transferencia" | "mercadopago";

export default function Carrito() {
  usarSeo("Carrito");
  const { lineas, unidades, subtotal, pesoKg, cargando, problemas, listoParaComprar } = useCarritoDetallado();
  const [envio, setEnvio] = useState<CotizacionDeEnvio | null>(null);
  const [medio, setMedio] = useState<Medio>("transferencia");
  const [sugeridos, setSugeridos] = useState<ProductoPublico[]>([]);

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

  const productosDelCarrito = useMemo(() => lineas.map((l) => l.producto).filter((p): p is ProductoPublico => Boolean(p)), [lineas]);
  const claveProductos = productosDelCarrito.map((p) => p.id).join(",");

  useEffect(() => {
    if (productosDelCarrito.length === 0) {
      setSugeridos([]);
      return;
    }
    let cancelado = false;
    complementosDe(productosDelCarrito, 4)
      .then((lista) => {
        if (!cancelado) setSugeridos(lista);
      })
      .catch(() => {
        if (!cancelado) setSugeridos([]);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveProductos]);

  if (lineas.length === 0) {
    return (
      <Tienda>
        <div className="container mx-auto flex flex-col gap-6 px-4 py-10">
          <Pasos />
          <div className="flex flex-col items-center gap-3.5 rounded-2xl border border-border bg-card p-10 text-center">
            <h1 className="text-xl font-bold">Tu carrito está vacío</h1>
            <p className="text-[15px] text-muted-foreground">Mirá los destacados de la semana o buscá por modelo.</p>
            <Link to="/" className="flex h-12 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90">
              Ver destacados
            </Link>
          </div>
        </div>
      </Tienda>
    );
  }

  const costoEnvio = envio?.disponible ? (envio.precio ?? 0) : null;
  const total = subtotal + (costoEnvio ?? 0);
  const textoEnvio = envio === null ? "Cotizando" : !envio.disponible ? "A confirmar" : envio.gratis ? "Sin cargo" : formatearPesos(envio.precio ?? 0);

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-7 px-4 pb-6 pt-6">
        <Pasos />
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="font-display text-[36px] font-bold uppercase leading-none md:text-[40px]">Carrito</h1>
          <span className="text-[15px] text-muted-foreground">{unidades === 1 ? "1 producto" : `${unidades} productos`}</span>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <section aria-label="Productos del carrito" className="flex min-w-0 flex-1 flex-col gap-4">
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {lineas.map(({ linea, producto }) => {
                const foto = producto ? imagenPrincipal(producto) : null;
                return (
                  <li key={linea.productoId} className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-[18px]">
                    <Link
                      to={producto ? rutaDelProducto(producto) : "#"}
                      className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-xl bg-placa-foto"
                    >
                      {foto && <img src={foto} alt="" className="max-h-[88px] max-w-[88px] object-contain mix-blend-multiply" />}
                    </Link>
                    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                      {producto ? (
                        <>
                          {producto.marca && <p className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{producto.marca}</p>}
                          <Link to={rutaDelProducto(producto)} className="text-[15px] font-medium leading-snug hover:underline">
                            {producto.nombre}
                          </Link>
                          <ChipsDeDatos datos={datosClave(producto, 3)} />
                          {producto.hay_stock ? <EstadoDeStock producto={producto} /> : <p className="text-sm text-danger">Sin stock: sacalo del carrito para seguir.</p>}
                        </>
                      ) : (
                        <p className="font-medium text-muted-foreground">{cargando ? "Cargando" : "Este producto ya no está en la tienda"}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => quitarDelCarrito(linea.productoId)}
                        className="self-start py-1.5 text-[13px] text-muted-foreground underline hover:text-foreground"
                      >
                        Quitar
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-input">
                        <button
                          type="button"
                          aria-label="Una unidad menos"
                          onClick={() => cambiarCantidad(linea.productoId, linea.cantidad - 1)}
                          className="flex h-11 w-10 items-center justify-center hover:bg-secondary"
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span aria-live="polite" className="w-8 text-center font-bold tabular-nums">
                          {linea.cantidad}
                        </span>
                        <button
                          type="button"
                          aria-label="Una unidad más"
                          onClick={() => cambiarCantidad(linea.productoId, linea.cantidad + 1)}
                          className="flex h-11 w-10 items-center justify-center hover:bg-secondary"
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      {producto?.precio_final_ars != null && (
                        <div className="flex min-w-[120px] flex-col items-end">
                          <span className="text-xl font-bold tabular-nums">{formatearPesos(producto.precio_final_ars * linea.cantidad)}</span>
                          <span className="text-xs text-muted-foreground">{linea.cantidad > 1 ? `${formatearPesos(producto.precio_final_ars)} c/u` : "Precio final"}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
              <li className="flex flex-wrap justify-between gap-2 px-5 py-3.5 text-sm">
                <Link to="/" className="font-bold hover:underline">
                  ← Seguir comprando
                </Link>
                <span className="text-muted-foreground">Precios finales con IVA incluido.</span>
              </li>
            </ul>

            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-5 py-[18px]">
              <p className="text-[15px] font-bold">Envío a domicilio</p>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3 text-sm">
                <span>{envio?.disponible ? `${textoDeDemora(envio)} desde que se acredita el pago` : "El plazo se confirma al comprar"}</span>
                <strong className="tabular-nums">{textoEnvio}</strong>
              </div>
              <p className="text-[13px] text-muted-foreground">Un solo servicio, el mismo para todo el país. El total que ves acá es el que vas a pagar.</p>
            </div>
          </section>

          <aside aria-label="Resumen de la compra" className="flex w-full flex-col gap-3.5 rounded-2xl border border-border bg-card p-[22px] lg:sticky lg:top-6 lg:w-[360px] lg:shrink-0">
            <p className="font-display text-lg font-bold uppercase tracking-[0.06em]">Resumen</p>
            <div role="radiogroup" aria-label="Cómo vas a pagar" className="grid grid-cols-2 gap-1.5 rounded-xl bg-background p-1">
              {(
                [
                  ["transferencia", "Transferencia"],
                  ["mercadopago", "Mercado Pago"],
                ] as Array<[Medio, string]>
              ).map(([valor, nombre]) => (
                <button
                  key={valor}
                  type="button"
                  role="radio"
                  aria-checked={medio === valor}
                  onClick={() => setMedio(valor)}
                  className={cn("h-[42px] rounded-[10px] text-sm font-bold transition-colors", medio === valor ? "bg-foreground text-background" : "hover:bg-secondary")}
                >
                  {nombre}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 text-[15px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Productos ({unidades})</span>
                <span className="tabular-nums">{formatearPesos(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Envío</span>
                <span className="tabular-nums">{textoEnvio}</span>
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3.5">
              <span className="font-bold">Total</span>
              <span className="text-[30px] font-bold tracking-[-0.02em] tabular-nums">{formatearPesos(total)}</span>
            </div>
            {medio === "mercadopago" ? (
              <Precio precioFinal={total} conCuotas className="[&>span]:hidden" />
            ) : (
              <p className="text-[13px] leading-relaxed text-muted-foreground">Al confirmar te damos los datos de la cuenta. El pedido se prepara cuando se acredita la transferencia.</p>
            )}
            {problemas.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-xl bg-error-fondo p-3 text-sm text-danger">
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <Link
              to={listoParaComprar ? `/checkout?medio=${medio}` : "#"}
              aria-disabled={!listoParaComprar}
              className={cn(
                "flex h-[52px] items-center justify-center rounded-xl text-base font-bold",
                listoParaComprar ? "bg-primary text-primary-foreground hover:bg-primary/90" : "pointer-events-none bg-secondary text-muted-foreground",
              )}
            >
              Iniciar la compra
            </Link>
            <ul className="flex flex-col gap-2 text-[13px] text-muted-foreground">
              <li>Sin registro: comprás como invitado y seguís el pedido con tu mail.</li>
              <li>No vemos ni guardamos los datos de tu tarjeta.</li>
              <li>10 días para arrepentirte desde que lo recibís.</li>
            </ul>
          </aside>
        </div>

        {sugeridos.length > 0 && (
          <Bloque etiqueta="Completá el setup" className="px-0 pt-3">
            <EncabezadoDeSeccion titulo="Completá el setup" bajada="Van bien con lo que tenés en el carrito." />
            <GrillaProductos productos={sugeridos} columnas="cuatro" />
          </Bloque>
        )}
      </div>
    </Tienda>
  );
}
