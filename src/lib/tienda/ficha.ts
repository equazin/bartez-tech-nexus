import type { ProductoPublico } from "./catalogo";

/**
 * Lectura de la ficha técnica para la tienda: los pares en orden, los datos que deciden la compra
 * (los chips de la tarjeta), la ficha agrupada de la página del producto y la comparación lado a lado.
 * Todo sale de `ficha` (panel o CSV) o, si está vacía, de las specs del mayorista.
 */

export interface ParDeFicha {
  clave: string;
  valor: string;
}

type ConFicha = Pick<ProductoPublico, "ficha" | "specs">;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function etiqueta(clave: string): string {
  const limpia = clave.replace(/[_-]+/g, " ").trim();
  return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

function valorComoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (Array.isArray(valor)) return valor.map(valorComoTexto).filter(Boolean).join(", ");
  return "";
}

/** La ficha cargada en el panel manda y conserva su orden; si no hay, las specs del mayorista. */
export function paresDeFicha(producto: ConFicha): ParDeFicha[] {
  const cargada = (producto.ficha ?? [])
    .filter((par) => par && typeof par.clave === "string" && typeof par.valor === "string")
    .map((par) => ({ clave: par.clave.trim(), valor: par.valor.trim() }))
    .filter((par) => par.clave !== "" && par.valor !== "");
  if (cargada.length > 0) return cargada;
  return Object.entries(producto.specs ?? {})
    .map(([clave, valor]) => ({ clave: etiqueta(clave), valor: valorComoTexto(valor) }))
    .filter((par) => par.valor !== "");
}

/** El valor de la primera clave que exista, sin importar mayúsculas ni acentos. */
export function valorDe(pares: ParDeFicha[], ...claves: string[]): string | null {
  const buscadas = claves.map(normalizar);
  for (const buscada of buscadas) {
    const par = pares.find((p) => normalizar(p.clave) === buscada);
    if (par) return par.valor;
  }
  return null;
}

function resolucionCorta(valor: string): string {
  const medida = valor.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
  if (medida) {
    const ancho = Number(medida[1]);
    const alto = Number(medida[2]);
    if (ancho >= 3840) return "4K";
    if (ancho >= 3440) return "UWQHD";
    if (ancho >= 2560) return "QHD";
    if (ancho === 1920 && alto === 1080) return "Full HD";
    return `${ancho} × ${alto}`;
  }
  if (/4k|uhd/i.test(valor)) return "4K";
  if (/qhd|1440/i.test(valor)) return "QHD";
  if (/full hd|fhd|1080/i.test(valor)) return "Full HD";
  return valor;
}

/** Versión corta de un valor, para chips y filtros: 27", QHD, 180 Hz, 16 GB, Ryzen 5 8640U. */
export function valorCorto(clave: string, valor: string): string {
  const k = normalizar(clave);
  const v = valor.trim();
  if (k === "pantalla" || k === "tamano") {
    const m = v.match(/(\d+(?:[.,]\d+)?)\s*(?:pulgadas|"|”|'')/i);
    if (m) return `${m[1].replace(".", ",")}"`;
  }
  if (k === "resolucion") return resolucionCorta(v);
  if (k === "frecuencia") {
    const m = v.match(/(\d+)\s*hz/i);
    if (m) return `${m[1]} Hz`;
  }
  if (k === "procesador") return v.replace(/^(AMD|Intel)\s+/i, "");
  if (k === "placa de video") return v.replace(/^(NVIDIA|AMD)\s+(GeForce\s+)?/i, "");
  if (["memoria", "memoria ram", "almacenamiento", "capacidad", "memoria de video"].includes(k)) {
    const m = v.match(/(\d+(?:[.,]\d+)?)\s*(GB|TB)/i);
    if (m) return `${m[1]} ${m[2].toUpperCase()}`;
  }
  if (k === "nucleos" && /^\d+$/.test(v)) return `${v} núcleos`;
  return v.length > 24 ? `${v.slice(0, 23)}…` : v;
}

/** Las claves que deciden la compra, según el tipo de producto. */
const CLAVES_POR_TIPO: Record<string, string[]> = {
  monitor: ["Pantalla", "Resolución", "Frecuencia", "Panel"],
  notebook: ["Procesador", "Memoria", "Almacenamiento", "Pantalla", "Placa de video"],
  placa: ["GPU", "Memoria de video", "Tipo de memoria"],
  procesador: ["Socket", "Núcleos", "Frecuencia máxima"],
  memoria: ["Capacidad", "Tipo", "Velocidad"],
  disco: ["Capacidad", "Formato", "Interfaz", "Lectura"],
  fuente: ["Potencia", "Certificación", "Cables"],
  gabinete: ["Formato", "Iluminación", "Color"],
  motherboard: ["Socket", "Chipset", "Formato"],
  cooler: ["Tipo", "Tamaño", "Iluminación"],
  periferico: ["Conexión", "Tipo", "Formato", "Switches", "Resolución del sensor", "Iluminación"],
  red: ["Wi-Fi", "Clase", "Red móvil", "Puertos"],
};

const PERIFERICOS = new Set([
  "teclados",
  "mouse",
  "auriculares",
  "parlantes",
  "webcams",
  "mousepads",
  "combos-de-teclado-y-mouse",
  "joysticks-y-volantes",
  "streaming",
]);

const COMPONENTES: Record<string, string> = {
  "placas-de-video": "placa",
  procesadores: "procesador",
  "memorias-ram": "memoria",
  "discos-internos": "disco",
  fuentes: "fuente",
  gabinetes: "gabinete",
  motherboards: "motherboard",
  "coolers-y-refrigeracion": "cooler",
};

export function tipoDeProducto(categoriaSlug: string | null): string {
  const slug = categoriaSlug ?? "";
  if (slug.startsWith("monitores")) return "monitor";
  if (slug.startsWith("notebooks")) return "notebook";
  if (COMPONENTES[slug]) return COMPONENTES[slug];
  if (PERIFERICOS.has(slug)) return "periferico";
  if (slug === "routers-y-wifi") return "red";
  return "otro";
}

const SIN_INTERES = /garant|color|peso|ean|modelo|c[oó]digo/i;

export interface DatoClave {
  valor: string;
  etiqueta: string;
}

/** Los datos que deciden la compra, con su etiqueta: para la ficha y los chips. */
export function datosClaveConEtiqueta(producto: ConFicha & Pick<ProductoPublico, "categoria_slug">, maximo = 4): DatoClave[] {
  const pares = paresDeFicha(producto);
  const claves = CLAVES_POR_TIPO[tipoDeProducto(producto.categoria_slug)] ?? [];
  const salida: DatoClave[] = [];
  for (const clave of claves) {
    if (salida.length >= maximo) break;
    const valor = valorDe(pares, clave);
    if (!valor) continue;
    const corto = valorCorto(clave, valor);
    if (salida.some((d) => d.valor === corto)) continue;
    const etiquetaDelDato = normalizar(clave) === "resolucion" && corto !== valor ? valor : clave;
    salida.push({ valor: corto, etiqueta: etiquetaDelDato });
  }
  if (salida.length < 2) {
    for (const par of pares) {
      if (salida.length >= Math.min(maximo, 3)) break;
      if (SIN_INTERES.test(par.clave)) continue;
      const corto = valorCorto(par.clave, par.valor);
      if (salida.some((d) => d.valor === corto)) continue;
      salida.push({ valor: corto, etiqueta: par.clave });
    }
  }
  return salida;
}

export function datosClave(producto: ConFicha & Pick<ProductoPublico, "categoria_slug">, maximo = 4): string[] {
  return datosClaveConEtiqueta(producto, maximo).map((d) => d.valor);
}

const GRUPOS: Array<{ titulo: string; patron: RegExp }> = [
  { titulo: "Pantalla", patron: /^(pantalla|tama[nñ]o|panel|resoluci[oó]n|frecuencia$|tiempo de respuesta|brillo|contraste|[aá]ngulo|dise[nñ]o|hdr|curvatura)/i },
  {
    titulo: "Rendimiento",
    patron:
      /^(procesador|memoria|almacenamiento|tipo de disco|placa de video|gpu|n[uú]cleos|hilos|frecuencia (base|m[aá]xima)|socket|arquitectura|familia|chipset|capacidad|velocidad|latencia|lectura|escritura|tipo de memoria|interfaz|potencia|certificaci[oó]n|sistema operativo|resoluci[oó]n del sensor|sensor|disipador|m[oó]dulos|voltaje)/i,
  },
  { titulo: "Conexiones", patron: /(puerto|conexi[oó]n|conector|wi-?fi|bluetooth|red m[oó]vil|clase|usb|hdmi|displayport|compatible|poe|vpn|tomas)/i },
  { titulo: "Físico", patron: /^(color|peso|dimensiones|formato|soporte vesa|material|iluminaci[oó]n|parlantes|ventilador|cables|teclas|botones|switches|transductor|tipo|ajuste|incluye|unidades|para|dise)/i },
];

/** La ficha agrupada para la página del producto: Pantalla, Rendimiento, Conexiones, Físico, Garantía. */
export function fichaAgrupada(pares: ParDeFicha[]): Array<{ titulo: string; pares: ParDeFicha[] }> {
  const grupos = new Map<string, ParDeFicha[]>();
  const orden = [...GRUPOS.map((g) => g.titulo), "Otros datos", "Garantía"];
  for (const titulo of orden) grupos.set(titulo, []);
  for (const par of pares) {
    if (/^garant/i.test(par.clave)) {
      grupos.get("Garantía")?.push(par);
      continue;
    }
    const grupo = GRUPOS.find((g) => g.patron.test(par.clave));
    grupos.get(grupo ? grupo.titulo : "Otros datos")?.push(par);
  }
  return orden.map((titulo) => ({ titulo, pares: grupos.get(titulo) ?? [] })).filter((g) => g.pares.length > 0);
}

/** Cuánto mejor es un valor para comparar: más es mejor, salvo las claves de MENOS_ES_MEJOR. */
const MENOS_ES_MEJOR = /tiempo de respuesta|latencia|peso|precio/i;
const NUMERICAS =
  /pantalla|tama[nñ]o|frecuencia|memoria|almacenamiento|capacidad|n[uú]cleos|hilos|brillo|contraste|lectura|escritura|potencia|velocidad|tiempo de respuesta|latencia|resoluci[oó]n|precio/i;

function puntaje(clave: string, valor: string): number | null {
  if (/resoluci[oó]n/i.test(clave) && !/sensor/i.test(clave)) {
    const medida = valor.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/);
    if (medida) return Number(medida[1]) * Number(medida[2]);
    if (/4k|uhd/i.test(valor)) return 3840 * 2160;
    if (/qhd|1440/i.test(valor)) return 2560 * 1440;
    if (/full hd|fhd|1080/i.test(valor)) return 1920 * 1080;
    return null;
  }
  const numero = valor.replace(/\./g, "").match(/(\d+(?:,\d+)?)/);
  if (!numero) return null;
  let n = Number(numero[1].replace(",", "."));
  if (/\btb\b/i.test(valor)) n *= 1024;
  return Number.isFinite(n) ? n : null;
}

export interface FilaComparada {
  clave: string;
  valores: Array<string | null>;
  mejores: boolean[];
}

/** Las filas de la comparación lado a lado, con la mejor celda marcada cuando se puede medir. */
export function compararFichas(fichas: ParDeFicha[][]): FilaComparada[] {
  const claves: string[] = [];
  for (const pares of fichas) {
    for (const par of pares) {
      if (!claves.some((c) => normalizar(c) === normalizar(par.clave))) claves.push(par.clave);
    }
  }
  return claves.map((clave) => {
    const valores = fichas.map((pares) => valorDe(pares, clave));
    const mejores = valores.map(() => false);
    if (NUMERICAS.test(clave)) {
      const puntajes = valores.map((v) => (v ? puntaje(clave, v) : null));
      const medidos = puntajes.filter((p): p is number => p !== null);
      if (medidos.length >= 2 && new Set(medidos).size > 1) {
        const objetivo = MENOS_ES_MEJOR.test(clave) ? Math.min(...medidos) : Math.max(...medidos);
        puntajes.forEach((p, i) => {
          mejores[i] = p === objetivo;
        });
      }
    }
    return { clave, valores, mejores };
  });
}

/** Solo para notebooks: la tienda vende configuraciones de fábrica, sin ampliaciones. */
export function esNotebook(categoriaSlug: string | null): boolean {
  return (categoriaSlug ?? "").startsWith("notebooks");
}
