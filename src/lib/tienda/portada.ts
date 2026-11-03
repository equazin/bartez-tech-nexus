import { supabase } from "@/lib/supabase";
import type { CategoriaPublica, ProductoPublico } from "./catalogo";
import { aplanar } from "./catalogo";

/**
 * Datos de la portada (docs/plan-pagina-y-contenido.md, sección 3). Todo sale de RPC públicos
 * que leen la vista tienda_productos: ningún bloque ve costo ni margen.
 */

export interface ElegidoDeLaSemana {
  producto: ProductoPublico;
  /** Hasta cuatro datos clave ("Ryzen 7 7735HS", "16 GB"). */
  datos: string[];
  /** Hasta tres razones de por qué lo elegimos. */
  razones: string[];
  desde: string | null;
}

export interface Portada {
  elegido: ElegidoDeLaSemana | null;
  garantia_meses: number | null;
  cuotas_maximas: number | null;
}

export interface MasVendidos {
  /** "ventas": las últimas cuatro semanas. "destacados": todavía no hay ventas suficientes. */
  origen: "ventas" | "destacados";
  productos: ProductoPublico[];
}

export interface MarcaPublica {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  cantidad: number;
}

const PORTADA_VACIA: Portada = { elegido: null, garantia_meses: null, cuotas_maximas: null };

function textos(valor: unknown, maximo: number): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, maximo);
}

function numeroONulo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/** Normaliza lo que devuelve tienda_portada(): cualquier dato raro queda afuera, no rompe la página. */
export function leerPortada(crudo: unknown): Portada {
  if (!crudo || typeof crudo !== "object") return PORTADA_VACIA;
  const datos = crudo as Record<string, unknown>;
  const elegidoCrudo = datos.elegido as Record<string, unknown> | null | undefined;
  const producto = elegidoCrudo && typeof elegidoCrudo.producto === "object" ? (elegidoCrudo.producto as ProductoPublico | null) : null;
  const razones = textos(elegidoCrudo?.razones, 3);
  return {
    elegido:
      producto && razones.length > 0
        ? { producto, datos: textos(elegidoCrudo?.datos, 4), razones, desde: typeof elegidoCrudo?.desde === "string" ? elegidoCrudo.desde : null }
        : null,
    garantia_meses: numeroONulo(datos.garantia_meses),
    cuotas_maximas: numeroONulo(datos.cuotas_maximas),
  };
}

export async function obtenerPortada(): Promise<Portada> {
  const { data, error } = await supabase.rpc("tienda_portada");
  if (error) throw new Error(`No se pudo cargar la portada: ${error.message}`);
  return leerPortada(data);
}

export async function obtenerMasVendidos(limite = 24): Promise<MasVendidos> {
  const { data, error } = await supabase.rpc("tienda_mas_vendidos", { p_limite: limite });
  if (error) throw new Error(`No se pudo cargar lo más vendido: ${error.message}`);
  const crudo = (data ?? {}) as { origen?: unknown; productos?: unknown };
  return {
    origen: crudo.origen === "ventas" ? "ventas" : "destacados",
    productos: Array.isArray(crudo.productos) ? (crudo.productos as ProductoPublico[]) : [],
  };
}

let marcasEnMemoria: Promise<MarcaPublica[]> | null = null;

/** Las marcas con productos a la vista, una sola vez por visita. */
export function listarMarcas(): Promise<MarcaPublica[]> {
  if (!marcasEnMemoria) {
    marcasEnMemoria = Promise.resolve(
      supabase.rpc("tienda_marcas").then(({ data, error }) => {
        if (error) {
          marcasEnMemoria = null;
          throw new Error(`No se pudieron cargar las marcas: ${error.message}`);
        }
        return (data ?? []) as MarcaPublica[];
      }),
    );
  }
  return marcasEnMemoria;
}

// ── Franja de confianza ──────────────────────────────────────────────────────

export interface Promesa {
  clave: "envio" | "garantia" | "cuotas" | "arrepentimiento";
  titulo: string;
  texto: string;
  enlace?: { ruta: string; etiqueta: string };
}

/**
 * Las cuatro promesas de la portada. Lo que el panel todavía no cargó (meses de garantía) va con
 * un marcador entre corchetes, como el resto de los datos a confirmar: nunca un número inventado.
 */
export function promesasDeConfianza(portada: Pick<Portada, "garantia_meses" | "cuotas_maximas">): Promesa[] {
  const meses = portada.garantia_meses;
  const cuotas = portada.cuotas_maximas;
  return [
    {
      clave: "envio",
      titulo: "Envío a todo el país",
      texto: "El mismo precio y el mismo plazo en cualquier provincia, a tu domicilio.",
    },
    {
      clave: "garantia",
      titulo: meses ? `Garantía de ${meses} ${meses === 1 ? "mes" : "meses"}` : "Garantía de [N] meses",
      texto: "Cubre fallas de fábrica. Te acompañamos en el trámite.",
      enlace: { ruta: "/garantias", etiqueta: "Cómo se tramita" },
    },
    {
      clave: "cuotas",
      titulo: cuotas && cuotas > 1 ? `Hasta ${cuotas} cuotas` : "Cuotas con Mercado Pago",
      texto: "Con tarjeta de crédito. Ves el total y el costo financiero antes de pagar.",
    },
    {
      clave: "arrepentimiento",
      titulo: "10 días para arrepentirte",
      texto: "Revocás la compra sin registro y te damos el código al instante.",
      enlace: { ruta: "/arrepentimiento", etiqueta: "Botón de arrepentimiento" },
    },
  ];
}

// ── Accesos directos a subcategorías ─────────────────────────────────────────

/** Los diez accesos de "Qué estás buscando", por slug de la migración 117 y con el nombre que busca la gente. */
export const ACCESOS_DIRECTOS: ReadonlyArray<{ slug: string; etiqueta: string }> = [
  { slug: "notebooks-gamer", etiqueta: "Notebooks gamer" },
  { slug: "notebooks-para-estudiar-y-trabajar", etiqueta: "Notebooks para estudiar" },
  { slug: "monitores-para-jugar", etiqueta: "Monitores para jugar" },
  { slug: "perifericos-teclados", etiqueta: "Teclados" },
  { slug: "perifericos-mouse", etiqueta: "Mouse" },
  { slug: "perifericos-auriculares", etiqueta: "Auriculares" },
  { slug: "accesorios-ssd-externos-y-pendrives", etiqueta: "SSD externos" },
  { slug: "perifericos-webcams", etiqueta: "Webcams" },
  { slug: "accesorios-hubs-y-adaptadores", etiqueta: "Hubs y adaptadores" },
  { slug: "accesorios-routers-y-wifi", etiqueta: "Routers y Wi-Fi" },
];

/** Los accesos que tienen productos, en el orden de la lista, con su cantidad. */
export function accesosConProductos(raices: CategoriaPublica[]): Array<{ slug: string; etiqueta: string; cantidad: number }> {
  const porSlug = new Map(aplanar(raices).map((c) => [c.slug, c]));
  return ACCESOS_DIRECTOS.flatMap((acceso) => {
    const categoria = porSlug.get(acceso.slug);
    return categoria && categoria.cantidad > 0 ? [{ ...acceso, cantidad: categoria.cantidad }] : [];
  });
}

// ── Chips de marca de "Lo más vendido" ───────────────────────────────────────

/** Las marcas presentes, de la que más aparece a la que menos, hasta un tope. */
export function marcasPresentes(productos: ProductoPublico[], tope = 6): Array<{ id: string; nombre: string }> {
  const cuenta = new Map<string, { nombre: string; n: number }>();
  for (const p of productos) {
    if (!p.marca_id) continue;
    const previo = cuenta.get(p.marca_id);
    cuenta.set(p.marca_id, { nombre: p.marca ?? "Sin marca", n: (previo?.n ?? 0) + 1 });
  }
  return [...cuenta.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].nombre.localeCompare(b[1].nombre, "es"))
    .slice(0, tope)
    .map(([id, { nombre }]) => ({ id, nombre }));
}
