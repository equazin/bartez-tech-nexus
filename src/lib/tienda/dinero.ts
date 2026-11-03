const formatoPesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** "$ 1.299.999": precios finales en pesos, sin centavos. */
export function formatearPesos(valor: number): string {
  if (!Number.isFinite(valor)) return "";
  return formatoPesos.format(Math.round(valor));
}
