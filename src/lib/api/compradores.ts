import { llamarPagos } from "./pagos";

/**
 * Los compradores de la tienda para el panel. La tienda no exige cuenta: un comprador es cada email distinto de las
 * compras. Los arma el servidor (api/_tienda/compradores.ts); estos tipos son los de su respuesta.
 */

export interface CompraDelComprador {
  id: number;
  numero: string;
  fecha: string;
  estado: string;
  medio: string | null;
  total: number;
  /** Nulo: la compra no guardó el costo del envío. */
  envio_costo: number | null;
  productos: string[];
}

export interface MailDelComprador {
  tipo: string;
  numero: string;
  anotado_en: string;
  /** Cuándo lo aceptó el servidor de correo. Nulo: no quedó confirmado. */
  confirmado_en: string | null;
}

export interface UltimoEnvio {
  opcion: string | null;
  sucursal: string | null;
  calle: string | null;
  numero: string | null;
  piso: string | null;
  localidad: string | null;
  provincia: string | null;
  codigo_postal: string | null;
}

export interface CompradorDelPanel {
  email: string;
  nombre: string | null;
  telefono: string | null;
  documento: string | null;
  con_cuenta: boolean;
  ultimo_envio: UltimoEnvio | null;
  /** De la más nueva a la más vieja. */
  compras: CompraDelComprador[];
  compras_pagas: number;
  total_pagado: number;
  primera_compra: string;
  esperando_pago: boolean;
  con_reintegro: boolean;
  puntos: { disponibles: number; pendientes: number; proxima_liberacion: string | null } | null;
  mails: MailDelComprador[];
}

export interface ListaDeCompradores {
  compradores: CompradorDelPanel[];
  hay_mas_compras: boolean;
}

export const listarCompradores = () => llamarPagos<ListaDeCompradores>("compradores");

/** Los estados de una compra, dichos de la compra. */
export const ESTADO_DE_LA_COMPRA: Record<string, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagada",
  preparando: "En preparación",
  enviado: "Enviada",
  entregado: "Entregada",
  cancelado: "Cancelada",
  reintegrado: "Reintegrada",
  vencido: "Vencida",
};

export const NOMBRE_DEL_MAIL: Record<string, string> = {
  pago_acreditado: "Pago acreditado",
  seguimiento: "Seguimiento del envío",
  enviado: "Compra en camino",
  entregado: "Compra entregada",
  cancelado: "Compra cancelada",
  reintegrado: "Reintegro",
};

export const ubicacionDe = (envio: UltimoEnvio | null): string => [envio?.localidad, envio?.provincia].filter(Boolean).join(", ");

/** El último envío en una línea: a domicilio con la dirección, o la sucursal donde retira. */
export function textoDelEnvio(envio: UltimoEnvio | null): string {
  if (!envio) return "";
  const lugar = ubicacionDe(envio);
  const codigo = envio.codigo_postal ? ` (CP ${envio.codigo_postal})` : "";
  if (envio.opcion === "sucursal") return [`Retiro en sucursal${envio.sucursal ? `: ${envio.sucursal}` : ""}`, `${lugar}${codigo}`].filter(Boolean).join(", ");
  const direccion = [[envio.calle, envio.numero].filter(Boolean).join(" "), envio.piso].filter(Boolean).join(", ");
  return [`A domicilio${direccion ? `: ${direccion}` : ""}`, `${lugar}${codigo}`].filter(Boolean).join(", ");
}

const LARGO_DEL_NUMERO_NACIONAL = 10;

/**
 * El enlace para escribirle por WhatsApp, o null si el teléfono no se puede llevar con seguridad al formato que pide
 * (549 + código de área + número, sin 0 ni 15). Mejor sin botón que con un enlace a otro número.
 */
export function enlaceDeWhatsApp(telefono: string | null): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  const sinCero = digitos.startsWith("0") ? digitos.slice(1) : digitos;
  if (sinCero.length === LARGO_DEL_NUMERO_NACIONAL) return `https://wa.me/549${sinCero}`;
  if (sinCero.startsWith("549") && sinCero.length === LARGO_DEL_NUMERO_NACIONAL + 3) return `https://wa.me/${sinCero}`;
  if (sinCero.startsWith("54") && sinCero.length === LARGO_DEL_NUMERO_NACIONAL + 2) return `https://wa.me/549${sinCero.slice(2)}`;
  return null;
}

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

/** Una celda de la planilla: entre comillas, con las comillas internas duplicadas. */
const celda = (valor: string | number | null): string => `"${String(valor ?? "").replace(/"/g, '""')}"`;

/** Descarga la lista como planilla (CSV con punto y coma, que es lo que abre Excel en español). */
export function descargarCompradores(compradores: CompradorDelPanel[]): void {
  const encabezado = ["Nombre", "Email", "Teléfono", "DNI", "Localidad", "Provincia", "Compras pagas", "Compras", "Total pagado", "Primera compra", "Última compra", "Estado de la última"];
  const filas = compradores.map((c) => [
    c.nombre,
    c.email,
    c.telefono,
    c.documento,
    c.ultimo_envio?.localidad ?? null,
    c.ultimo_envio?.provincia ?? null,
    c.compras_pagas,
    c.compras.length,
    c.total_pagado,
    formatoFecha.format(new Date(c.primera_compra)),
    c.compras[0] ? formatoFecha.format(new Date(c.compras[0].fecha)) : null,
    c.compras[0] ? (ESTADO_DE_LA_COMPRA[c.compras[0].estado] ?? c.compras[0].estado) : null,
  ]);
  // El BOM del principio hace que Excel lea los acentos.
  const texto = `﻿${[encabezado, ...filas].map((fila) => fila.map(celda).join(";")).join("\r\n")}`;
  const direccion = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = direccion;
  enlace.download = `compradores-teqo-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(direccion);
}
