import { supabase } from "@/lib/supabase";
import type { OrdenDelCatalogo } from "./catalogo";

/**
 * Las secciones del inicio, en el orden del panel (Marketing › Secciones del inicio). Sin filas o si la
 * consulta falla, la tienda usa SECCIONES_POR_DEFECTO: el inicio de siempre.
 */

export type TipoDeSeccion = "portada" | "categorias" | "productos" | "elegido" | "componentes" | "comparador" | "por_uso" | "marcas" | "ayuda";
export type FuenteDeProductos = "mano" | "destacados" | "categoria";
export type FormatoDeFila = "grilla" | "carrusel";

export interface ConfigDeSeccion {
  fuente?: FuenteDeProductos;
  categoria?: string;
  orden?: OrdenDelCatalogo;
  formato?: FormatoDeFila;
  cantidad?: number;
  ids?: number[];
  pestanas?: boolean;
  slugs?: string[];
  producto_id?: number | null;
}

export interface SeccionDelInicio {
  id: string;
  tipo: TipoDeSeccion;
  titulo: string;
  bajada: string;
  config: ConfigDeSeccion;
}

export const MAXIMO_EN_GRILLA = 8;
export const MAXIMO_EN_CARRUSEL = 24;

export const NOMBRES_DE_TIPO: Record<TipoDeSeccion, string> = {
  portada: "Carrusel de portadas",
  categorias: "Accesos a categorías",
  productos: "Fila de productos",
  elegido: "Un producto destacado",
  componentes: "Armá tu PC con productos",
  comparador: "Comparador",
  por_uso: "Accesos por uso",
  marcas: "Marcas",
  ayuda: "Ayuda",
};

const s = (id: string, tipo: TipoDeSeccion, titulo: string, config: ConfigDeSeccion = {}, bajada = ""): SeccionDelInicio => ({ id, tipo, titulo, bajada, config });

export const SECCIONES_POR_DEFECTO: SeccionDelInicio[] = [
  s("portada", "portada", "Portada"),
  s("categorias", "categorias", "Qué estás buscando", { slugs: [] }),
  s("destacados", "productos", "Destacados", { fuente: "destacados", formato: "grilla", cantidad: 6, pestanas: true }, "Elegidos por el equipo de Teqo esta semana."),
  s("elegido", "elegido", "Elegido de la semana"),
  s("componentes", "componentes", "PC y componentes", { fuente: "categoria", categoria: "pc-y-componentes", orden: "destacados", formato: "grilla", cantidad: 4 }),
  s("por_uso", "por_uso", "Por uso"),
  s("notebooks", "productos", "Notebooks", { fuente: "categoria", categoria: "notebooks", orden: "destacados", formato: "grilla", cantidad: 5 }),
  s("comparador", "comparador", "Tres monitores, lado a lado.", { categoria: "monitores-para-jugar" }),
  s("perifericos", "productos", "Periféricos", { fuente: "categoria", categoria: "perifericos", orden: "destacados", formato: "grilla", cantidad: 6 }),
  s("marcas", "marcas", "Marcas"),
  s("ayuda", "ayuda", "Ayuda"),
];

/** Los datos que compara la tabla según la categoría; sin entrada, compara todos los que tengan en común. */
export const CLAVES_PARA_COMPARAR: Array<{ patron: RegExp; claves: string[] }> = [
  { patron: /monitor/, claves: ["Pantalla", "Panel", "Resolución", "Frecuencia", "Tiempo de respuesta"] },
  { patron: /notebook/, claves: ["Procesador", "Memoria RAM", "Almacenamiento", "Pantalla", "Placa de video"] },
  { patron: /procesador/, claves: ["Socket", "Núcleos", "Hilos", "Frecuencia", "Frecuencia máxima", "TDP", "Gráficos integrados"] },
  { patron: /placas-de-video/, claves: ["Chipset", "GPU", "Memoria", "Tipo de memoria", "Fuente recomendada"] },
  { patron: /memorias/, claves: ["Capacidad", "Tipo", "Frecuencia", "Formato"] },
  { patron: /discos/, claves: ["Capacidad", "Interfaz", "Formato", "Velocidad de lectura"] },
];

export async function listarSeccionesDelInicio(): Promise<SeccionDelInicio[]> {
  const { data, error } = await supabase.from("tienda_secciones_inicio").select("id, tipo, titulo, bajada, config").order("orden");
  if (error) throw new Error(`No se pudieron leer las secciones del inicio: ${error.message}`);
  return ((data ?? []) as Array<SeccionDelInicio & { config: ConfigDeSeccion | null }>).map((x) => ({ ...x, bajada: x.bajada ?? "", config: x.config ?? {} }));
}
