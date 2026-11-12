/**
 * El resumen del tablero que arma la base (función panel_tablero, migración 142): visitas, catálogo, dólar, última
 * sincronización y pagos acreditados. Lo que llega se revisa campo por campo: un dato que falta queda en cero o
 * nulo y el tablero sigue andando.
 */

import { supabase } from "@/lib/supabase";
import type { PagoDelTablero } from "@/lib/panel/ventas";

export interface VisitasDelDia {
  dia: string;
  sesiones: number;
  vistas: number;
}

export interface ProductoVisto {
  id: number;
  nombre: string;
  sesiones: number;
  vistas: number;
  hayStock: boolean;
  publicado: boolean;
}

export interface OrigenDeVisitas {
  origen: string;
  sesiones: number;
}

export interface VisitasDelTablero {
  sesiones: number;
  vistas: number;
  /** Sesiones que abrieron la ficha de un producto, el carrito y el checkout. */
  producto: number;
  carrito: number;
  checkout: number;
  sesionesAntes: number;
  vistasAntes: number;
  porDia: VisitasDelDia[];
  productos: ProductoVisto[];
  origenes: OrigenDeVisitas[];
}

export interface CatalogoDelTablero {
  publicados: number;
  sinStock: number;
  pocasUnidades: number;
  sinFoto: number;
  sinDescripcion: number;
  sinPrecio: number;
  precioManual: number;
  enOferta: number;
  dePrueba: number;
  sinPublicar: number;
}

export interface DolarDelTablero {
  valor: number;
  desde: string | null;
  fuente: string | null;
  nota: string | null;
}

export interface SincronizacionDelTablero {
  termino: string | null;
  /** Estado de cada mayorista en la última corrida: "ok" u otro texto si falló. */
  mayoristas: Array<{ nombre: string; estado: string }>;
}

export interface ResumenDelTablero {
  visitas: VisitasDelTablero;
  catalogo: CatalogoDelTablero;
  productosDePrueba: number[];
  dolar: DolarDelTablero | null;
  sincronizacion: SincronizacionDelTablero | null;
  pagos: PagoDelTablero[];
  arrepentimientosAbiertos: number;
  pendienteVenceHoras: number | null;
}

type Dato = Record<string, unknown>;

const esObjeto = (v: unknown): v is Dato => typeof v === "object" && v !== null && !Array.isArray(v);
const objeto = (v: unknown): Dato => (esObjeto(v) ? v : {});
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const numero = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const numeroONulo = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const textoONulo = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

const MAYORISTAS: ReadonlyArray<{ clave: string; nombre: string }> = [
  { clave: "elit", nombre: "ELIT" },
  { clave: "newbytes", nombre: "New Bytes" },
];

function leerVisitas(crudo: unknown): VisitasDelTablero {
  const v = objeto(crudo);
  return {
    sesiones: numero(v.sesiones),
    vistas: numero(v.vistas),
    producto: numero(v.producto),
    carrito: numero(v.carrito),
    checkout: numero(v.checkout),
    sesionesAntes: numero(v.sesiones_antes),
    vistasAntes: numero(v.vistas_antes),
    porDia: lista(v.por_dia)
      .map(objeto)
      .map((d) => ({ dia: texto(d.dia), sesiones: numero(d.sesiones), vistas: numero(d.vistas) }))
      .filter((d) => d.dia !== ""),
    productos: lista(v.productos)
      .map(objeto)
      .map((p) => ({
        id: numero(p.id),
        nombre: texto(p.nombre) || "Producto sin nombre",
        sesiones: numero(p.sesiones),
        vistas: numero(p.vistas),
        hayStock: p.hay_stock === true,
        publicado: p.publicado === true,
      })),
    origenes: lista(v.origenes)
      .map(objeto)
      .map((o) => ({ origen: texto(o.origen) || "Sin dato", sesiones: numero(o.sesiones) })),
  };
}

function leerCatalogo(crudo: unknown): CatalogoDelTablero {
  const c = objeto(crudo);
  return {
    publicados: numero(c.publicados),
    sinStock: numero(c.sin_stock),
    pocasUnidades: numero(c.pocas_unidades),
    sinFoto: numero(c.sin_foto),
    sinDescripcion: numero(c.sin_descripcion),
    sinPrecio: numero(c.sin_precio),
    precioManual: numero(c.precio_manual),
    enOferta: numero(c.en_oferta),
    dePrueba: numero(c.de_prueba),
    sinPublicar: numero(c.sin_publicar),
  };
}

function leerSincronizacion(crudo: unknown): SincronizacionDelTablero | null {
  if (!esObjeto(crudo)) return null;
  const detalle = objeto(crudo.detalle);
  const mayoristas = MAYORISTAS.filter((m) => esObjeto(detalle[m.clave])).map((m) => ({
    nombre: m.nombre,
    estado: texto(objeto(detalle[m.clave]).estado) || "sin dato",
  }));
  return { termino: textoONulo(detalle.termino) ?? textoONulo(crudo.actualizado_en), mayoristas };
}

function leerPagos(crudo: unknown): PagoDelTablero[] {
  return lista(crudo)
    .map(objeto)
    .filter((p) => p.order_id !== null && p.order_id !== undefined)
    .map((p) => ({
      order_id: numero(p.order_id),
      proveedor: texto(p.proveedor),
      estado: texto(p.estado),
      cuotas: numeroONulo(p.cuotas),
      comision: numeroONulo(p.comision),
      reintegrado: numero(p.reintegrado),
    }));
}

/** `desde` y `hasta` son días de Argentina (AAAA-MM-DD), los dos incluidos. */
export async function leerTablero(desde: string, hasta: string): Promise<ResumenDelTablero> {
  const { data, error } = await supabase.rpc("panel_tablero", { p_desde: desde, p_hasta: hasta });
  if (error) throw new Error(error.message || "No se pudo leer el resumen de la tienda.");
  const r = objeto(data);
  const d = objeto(r.dolar);
  const dolar: DolarDelTablero | null =
    numero(d.valor) > 0 ? { valor: numero(d.valor), desde: textoONulo(d.desde), fuente: textoONulo(d.fuente), nota: textoONulo(d.nota) } : null;
  return {
    visitas: leerVisitas(r.visitas),
    catalogo: leerCatalogo(r.catalogo),
    productosDePrueba: lista(r.productos_de_prueba).map(numero).filter((id) => id > 0),
    dolar,
    sincronizacion: leerSincronizacion(r.sincronizacion),
    pagos: leerPagos(r.pagos),
    arrepentimientosAbiertos: numero(r.arrepentimientos_abiertos),
    pendienteVenceHoras: numeroONulo(r.pendiente_vence_horas),
  };
}
