import { useEffect, useMemo, useState } from "react";
import { listarProductosPorIds, type PrecioPorMedio, type ProductoPublico } from "./catalogo";
import { precioConMedio, preciosDe } from "./precios";
import { useCarrito, type LineaDelCarrito } from "./carrito";
import { esPcCompleta, servicioDisponible, useServicios, type ServicioPublico } from "./servicios";

export interface LineaDetallada {
  linea: LineaDelCarrito;
  producto: ProductoPublico | null;
}

/** El carrito con sus productos y servicios cargados desde la vista pública: subtotal y peso para cotizar el envío. */
export function useCarritoDetallado() {
  const { carrito, unidades } = useCarrito();
  const servicios = useServicios();
  const [productos, setProductos] = useState<Map<number, ProductoPublico>>(new Map());
  const [cargando, setCargando] = useState(false);
  const ids = carrito.lineas.map((l) => l.productoId);
  const claveIds = ids.join(",");

  useEffect(() => {
    const faltan = ids.filter((id) => !productos.has(id));
    if (faltan.length === 0) return;
    let cancelado = false;
    setCargando(true);
    listarProductosPorIds(faltan)
      .then((lista) => {
        if (cancelado) return;
        setProductos((previos) => {
          const siguiente = new Map(previos);
          for (const p of lista) siguiente.set(p.id, p);
          for (const id of faltan) if (!siguiente.has(id)) siguiente.set(id, null as unknown as ProductoPublico);
          return siguiente;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveIds]);

  const lineas = useMemo<LineaDetallada[]>(
    () => carrito.lineas.map((linea) => ({ linea, producto: productos.get(linea.productoId) ?? null })),
    [carrito.lineas, productos],
  );

  const pcCompleta = useMemo(() => esPcCompleta(lineas.map(({ producto }) => producto?.categoria_slug)), [lineas]);
  /** Los servicios que se pueden sumar a este carrito: los "solo con PC" piden una PC completa. */
  const serviciosOfrecidos = useMemo<ServicioPublico[]>(() => servicios.filter((s) => servicioDisponible(s, pcCompleta)), [servicios, pcCompleta]);
  const serviciosElegidos = useMemo<ServicioPublico[]>(
    () => serviciosOfrecidos.filter((s) => carrito.servicios.includes(s.id)),
    [serviciosOfrecidos, carrito.servicios],
  );

  const subtotal = useMemo(
    () =>
      lineas.reduce((suma, { linea, producto }) => suma + (producto?.precio_final_ars ?? 0) * linea.cantidad, 0) +
      serviciosElegidos.reduce((suma, s) => suma + (s.precio_final_ars ?? 0), 0),
    [lineas, serviciosElegidos],
  );

  /** Los medios activos según los productos cargados, del más barato al más caro. */
  const medios = useMemo<PrecioPorMedio[]>(() => {
    const conMedios = lineas.find(({ producto }) => producto && (producto.precios_por_medio ?? []).length > 0)?.producto;
    return conMedios ? preciosDe(conMedios) : [];
  }, [lineas]);

  /** El subtotal de los productos pagando con cada medio (cada uno con su recargo). */
  const subtotalPorMedio = useMemo<Record<string, number>>(() => {
    const totales: Record<string, number> = {};
    for (const medio of medios) {
      totales[medio.id] =
        lineas.reduce((suma, { linea, producto }) => suma + (producto ? (precioConMedio(producto, medio.id) ?? 0) : 0) * linea.cantidad, 0) +
        serviciosElegidos.reduce((suma, s) => suma + (precioConMedio(s, medio.id) ?? 0), 0);
    }
    return totales;
  }, [lineas, medios, serviciosElegidos]);

  const pesoKg = useMemo(() => lineas.reduce((suma, { linea, producto }) => suma + (producto?.peso_kg ?? 1) * linea.cantidad, 0), [lineas]);

  const problemas = useMemo(
    () =>
      lineas.flatMap(({ linea, producto }) => {
        if (!producto) return [`Un producto del carrito ya no está en la tienda.`];
        if (!producto.hay_stock) return [`"${producto.nombre}" se quedó sin stock.`];
        if (producto.precio_final_ars === null) return [`"${producto.nombre}" no tiene precio todavía.`];
        return linea.cantidad > 0 ? [] : [];
      }),
    [lineas],
  );

  return {
    carrito,
    lineas,
    unidades,
    subtotal,
    medios,
    subtotalPorMedio,
    pcCompleta,
    serviciosOfrecidos,
    serviciosElegidos,
    pesoKg,
    cargando,
    problemas,
    listoParaComprar: lineas.length > 0 && problemas.length === 0 && !cargando,
  };
}
