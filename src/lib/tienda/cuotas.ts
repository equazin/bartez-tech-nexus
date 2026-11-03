import { useEffect, useState } from "react";

/** Lo que devuelve /api/precios?recurso=cuotas: las cuotas de Mercado Pago para un monto, o sin datos. */
export interface PlanDeCuotas {
  cuotas: number;
  monto_cuota: number;
  total: number;
  tea: number;
  cftea: number;
}

export interface TarjetaConCuotas {
  id: string;
  nombre: string;
  emisor: string | null;
  planes: PlanDeCuotas[];
}

export interface CuotasDeLaTienda {
  origen: "mercadopago" | "sin_datos";
  actualizado_en: string | null;
  monto: number | null;
  tarjetas: TarjetaConCuotas[];
}

const SIN_DATOS: CuotasDeLaTienda = { origen: "sin_datos", actualizado_en: null, monto: null, tarjetas: [] };
const guardadas = new Map<number, Promise<CuotasDeLaTienda>>();

export function obtenerCuotas(monto: number): Promise<CuotasDeLaTienda> {
  const clave = Math.round(monto * 100);
  if (!Number.isFinite(monto) || monto <= 0) return Promise.resolve(SIN_DATOS);
  const enCurso = guardadas.get(clave);
  if (enCurso) return enCurso;
  const pedido = fetch(`/api/precios?recurso=cuotas&monto=${encodeURIComponent(monto.toFixed(2))}`)
    .then(async (r) => {
      const json = (await r.json().catch(() => ({}))) as { ok?: boolean; data?: CuotasDeLaTienda };
      return r.ok && json.data ? json.data : SIN_DATOS;
    })
    .catch(() => {
      guardadas.delete(clave);
      return SIN_DATOS;
    });
  guardadas.set(clave, pedido);
  return pedido;
}

/** El plan con más cuotas entre todas las tarjetas: el que se anuncia en la tarjeta y la ficha. */
export function mejorPlan(cuotas: CuotasDeLaTienda): { tarjeta: TarjetaConCuotas; plan: PlanDeCuotas } | null {
  let mejor: { tarjeta: TarjetaConCuotas; plan: PlanDeCuotas } | null = null;
  for (const tarjeta of cuotas.tarjetas) {
    for (const plan of tarjeta.planes) {
      if (!mejor || plan.cuotas > mejor.plan.cuotas) mejor = { tarjeta, plan };
    }
  }
  return mejor;
}

export function useCuotas(monto: number | null | undefined): CuotasDeLaTienda | null {
  const [cuotas, setCuotas] = useState<CuotasDeLaTienda | null>(null);
  useEffect(() => {
    if (monto === null || monto === undefined || monto <= 0) {
      setCuotas(null);
      return;
    }
    let cancelado = false;
    obtenerCuotas(monto).then((resultado) => {
      if (!cancelado) setCuotas(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [monto]);
  return cuotas;
}
