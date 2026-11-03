import { useSyncExternalStore } from "react";
import type { ProductoPublico } from "./catalogo";
import { paresDeFicha, valorDe } from "./ficha";

/**
 * Armá tu PC: los pasos, los datos de compatibilidad que se leen de la ficha de cada componente
 * y las reglas que cruzan una pieza con las ya elegidas. Si falta un dato, la pieza no se marca
 * como incompatible: se avisa que hay que confirmarlo en la ficha.
 */

export type IdDePaso = "procesador" | "motherboard" | "memoria" | "almacenamiento" | "video" | "fuente" | "gabinete" | "cooler";

export interface Paso {
  id: IdDePaso;
  nombre: string;
  /** Las categorías de la tienda de donde salen las opciones. */
  categorias: string[];
  /** Sin esta pieza la PC no arranca (salvo que ya la tengas). */
  necesaria: boolean;
  ayuda: string;
}

export const PASOS: Paso[] = [
  { id: "procesador", nombre: "Procesador", categorias: ["procesadores"], necesaria: true, ayuda: "El socket define qué motherboard y qué memoria podés usar." },
  { id: "motherboard", nombre: "Motherboard", categorias: ["motherboards"], necesaria: true, ayuda: "Tiene que tener el mismo socket que el procesador." },
  { id: "memoria", nombre: "Memoria RAM", categorias: ["memorias-ram"], necesaria: true, ayuda: "DDR4 o DDR5 según la motherboard, y de PC (UDIMM), no de notebook." },
  { id: "almacenamiento", nombre: "Almacenamiento", categorias: ["discos-internos"], necesaria: true, ayuda: "Un SSD M.2 o SATA para el sistema; un disco rígido suma espacio." },
  { id: "video", nombre: "Placa de video", categorias: ["placas-de-video"], necesaria: false, ayuda: "Necesaria si el procesador no tiene gráficos integrados." },
  { id: "fuente", nombre: "Fuente", categorias: ["fuentes"], necesaria: true, ayuda: "Te mostramos la potencia recomendada según el procesador y la placa de video." },
  { id: "gabinete", nombre: "Gabinete", categorias: ["gabinetes"], necesaria: true, ayuda: "Tiene que entrar el formato de la motherboard." },
  { id: "cooler", nombre: "Cooler", categorias: ["coolers-y-refrigeracion"], necesaria: false, ayuda: "Necesario si el procesador no trae cooler." },
];

export function pasoDeCategoria(categoriaSlug: string | null): IdDePaso | null {
  if (!categoriaSlug) return null;
  return PASOS.find((p) => p.categorias.includes(categoriaSlug))?.id ?? null;
}

// ── Lectura de la ficha ─────────────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function dato(producto: ProductoPublico, ...claves: string[]): string | null {
  return valorDe(paresDeFicha(producto), ...claves);
}

function siNo(valor: string | null): boolean | null {
  if (!valor) return null;
  const v = normalizar(valor);
  if (v.startsWith("si")) return true;
  if (v.startsWith("no")) return false;
  return null;
}

function vatios(valor: string | null): number | null {
  const m = valor?.match(/(\d{2,4})\s*w/i);
  return m ? Number(m[1]) : null;
}

function numero(valor: string | null): number | null {
  const m = valor?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function tiposDeMemoria(valor: string | null): string[] {
  return valor ? [...new Set([...valor.toUpperCase().matchAll(/DDR\s?(\d)/g)].map((m) => `DDR${m[1]}`))] : [];
}

type FormatoDePlaca = "E-ATX" | "ATX" | "Micro ATX" | "Mini-ITX";

function formatoDePlaca(valor: string): FormatoDePlaca | null {
  const v = normalizar(valor).replace(/\s+/g, "");
  if (v.includes("e-atx") || v.includes("eatx")) return "E-ATX";
  if (v.includes("micro") || v.includes("matx")) return "Micro ATX";
  if (v.includes("itx")) return "Mini-ITX";
  if (v.includes("atx")) return "ATX";
  return null;
}

function placasQueEntran(gabinete: ProductoPublico): FormatoDePlaca[] | null {
  const lista = dato(gabinete, "Motherboards compatibles");
  if (lista) {
    const formatos = lista.split(/[,/]/).map((f) => formatoDePlaca(f)).filter((f): f is FormatoDePlaca => f !== null);
    if (formatos.length > 0) return [...new Set(formatos)];
  }
  const formato = normalizar(dato(gabinete, "Formato") ?? "");
  if (formato.includes("mini tower") || formato.includes("micro")) return ["Micro ATX", "Mini-ITX"];
  if (formato.includes("mid tower")) return ["ATX", "Micro ATX", "Mini-ITX"];
  if (formato.includes("full tower")) return ["E-ATX", "ATX", "Micro ATX", "Mini-ITX"];
  return null;
}

/** Los datos de compatibilidad de un componente, leídos de su ficha. */
export function datosDeCompatibilidad(p: ProductoPublico) {
  return {
    socket: dato(p, "Socket")?.toUpperCase().replace(/\s+/g, "") ?? null,
    memorias: tiposDeMemoria(dato(p, "Memoria compatible") ?? dato(p, "Tipo")),
    formatoDeMemoria: dato(p, "Formato de memoria", "Formato"),
    formatoDePlaca: (() => {
      const f = dato(p, "Formato");
      return f ? formatoDePlaca(f) : null;
    })(),
    tdp: vatios(dato(p, "TDP")),
    graficosIntegrados: siNo(dato(p, "Gráficos integrados")),
    coolerIncluido: siNo(dato(p, "Cooler incluido")),
    potencia: vatios(dato(p, "Potencia")),
    fuenteRecomendada: vatios(dato(p, "Fuente recomendada")),
    fuenteIncluida: siNo(dato(p, "Fuente incluida")),
    potenciaDeLaFuenteIncluida: vatios(dato(p, "Potencia de la fuente")) ?? vatios(dato(p, "Fuente incluida")),
    ranurasM2: numero(dato(p, "Ranuras M.2")),
    puertosSata: numero(dato(p, "Puertos SATA")),
    slotsDeMemoria: numero(dato(p, "Slots de memoria")),
    interfazDeDisco: dato(p, "Interfaz"),
    formatoDeDisco: dato(p, "Formato"),
    tipo: dato(p, "Tipo"),
  };
}

// ── La selección ────────────────────────────────────────────────────────────

export interface PiezaElegida {
  id: number;
  cantidad: number;
}

export interface Armado {
  piezas: Partial<Record<IdDePaso, PiezaElegida>>;
  /** Pasos que el cliente marcó como "ya tengo esta pieza". */
  yaTengo: IdDePaso[];
}

export type Seleccion = Partial<Record<IdDePaso, ProductoPublico>>;

const CLAVE = "teqo_armador";
const EVENTO = "teqo:armador";
const VACIO: Armado = { piezas: {}, yaTengo: [] };

function leer(): Armado {
  if (typeof window === "undefined") return VACIO;
  try {
    const crudo = window.localStorage.getItem(CLAVE);
    if (!crudo) return VACIO;
    const a = JSON.parse(crudo) as Partial<Armado>;
    const piezas: Armado["piezas"] = {};
    for (const paso of PASOS) {
      const pieza = a.piezas?.[paso.id];
      if (pieza && typeof pieza.id === "number") piezas[paso.id] = { id: pieza.id, cantidad: Math.max(1, Math.min(8, Math.floor(pieza.cantidad ?? 1))) };
    }
    const yaTengo = Array.isArray(a.yaTengo) ? a.yaTengo.filter((id): id is IdDePaso => PASOS.some((p) => p.id === id)) : [];
    return { piezas, yaTengo };
  } catch {
    return VACIO;
  }
}

function guardar(armado: Armado): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(armado));
  } catch {
    // Sin almacenamiento, el armado vive solo en esta vista.
  }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

export function elegirPieza(paso: IdDePaso, id: number, cantidad = 1): void {
  const actual = leer();
  guardar({ piezas: { ...actual.piezas, [paso]: { id, cantidad } }, yaTengo: actual.yaTengo.filter((p) => p !== paso) });
}

export function cambiarCantidadDePieza(paso: IdDePaso, cantidad: number): void {
  const actual = leer();
  const pieza = actual.piezas[paso];
  if (!pieza) return;
  guardar({ ...actual, piezas: { ...actual.piezas, [paso]: { ...pieza, cantidad: Math.max(1, Math.min(8, cantidad)) } } });
}

export function quitarPieza(paso: IdDePaso): void {
  const actual = leer();
  const piezas = { ...actual.piezas };
  delete piezas[paso];
  guardar({ ...actual, piezas });
}

export function alternarYaTengo(paso: IdDePaso): void {
  const actual = leer();
  const tiene = actual.yaTengo.includes(paso);
  const piezas = { ...actual.piezas };
  if (!tiene) delete piezas[paso];
  guardar({ piezas, yaTengo: tiene ? actual.yaTengo.filter((p) => p !== paso) : [...actual.yaTengo, paso] });
}

export function vaciarArmado(): void {
  guardar(VACIO);
}

let ultimoTexto: string | null = null;
let ultimoArmado: Armado = VACIO;

function instantanea(): Armado {
  if (typeof window === "undefined") return VACIO;
  let texto: string | null = null;
  try {
    texto = window.localStorage.getItem(CLAVE);
  } catch {
    texto = null;
  }
  if (texto !== ultimoTexto) {
    ultimoTexto = texto;
    ultimoArmado = leer();
  }
  return ultimoArmado;
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

export function useArmado(): Armado {
  return useSyncExternalStore(suscribir, instantanea, () => VACIO);
}

// ── Reglas ──────────────────────────────────────────────────────────────────

export type EstadoDeCompatibilidad = "compatible" | "incompatible" | "revisar";

export interface Evaluacion {
  estado: EstadoDeCompatibilidad;
  motivo: string | null;
}

const OK: Evaluacion = { estado: "compatible", motivo: null };

function redondearA50(valor: number): number {
  return Math.ceil(valor / 50) * 50;
}

/** La potencia de fuente recomendada para lo elegido: estimada, con margen. */
export function potenciaRecomendada(seleccion: Seleccion): number {
  const cpu = seleccion.procesador ? datosDeCompatibilidad(seleccion.procesador) : null;
  const gpu = seleccion.video ? datosDeCompatibilidad(seleccion.video) : null;
  const consumoCpu = cpu?.tdp ?? 95;
  const base = consumoCpu + (seleccion.video ? 250 : 50) + 100;
  return redondearA50(Math.max(base, gpu?.fuenteRecomendada ?? 0, 400));
}

function memoriaDePc(formato: string | null): boolean | null {
  if (!formato) return null;
  const f = normalizar(formato);
  if (f.includes("sodimm") || f.includes("notebook")) return false;
  if (f.includes("udimm") || f.includes("escritorio") || f.includes("dimm")) return true;
  return null;
}

/** Cómo encaja un producto en un paso, según las piezas ya elegidas en los otros pasos. */
export function evaluar(paso: IdDePaso, producto: ProductoPublico, seleccion: Seleccion): Evaluacion {
  const d = datosDeCompatibilidad(producto);
  const cpu = seleccion.procesador ? datosDeCompatibilidad(seleccion.procesador) : null;
  const placa = seleccion.motherboard ? datosDeCompatibilidad(seleccion.motherboard) : null;
  const ram = seleccion.memoria ? datosDeCompatibilidad(seleccion.memoria) : null;
  const gabinete = seleccion.gabinete ?? null;

  switch (paso) {
    case "procesador": {
      if (placa?.socket && d.socket && placa.socket !== d.socket) return { estado: "incompatible", motivo: `La motherboard es ${placa.socket}` };
      if (ram && ram.memorias.length > 0 && d.memorias.length > 0 && !ram.memorias.some((m) => d.memorias.includes(m)))
        return { estado: "incompatible", motivo: `No usa memoria ${ram.memorias.join("/")}` };
      if (placa && (!placa.socket || !d.socket)) return { estado: "revisar", motivo: "Confirmá el socket en la ficha" };
      return OK;
    }
    case "motherboard": {
      if (cpu?.socket && d.socket && cpu.socket !== d.socket) return { estado: "incompatible", motivo: `El procesador es ${cpu.socket}` };
      if (ram && ram.memorias.length > 0 && d.memorias.length > 0 && !ram.memorias.some((m) => d.memorias.includes(m)))
        return { estado: "incompatible", motivo: `Usa ${d.memorias.join("/")} y la memoria es ${ram.memorias.join("/")}` };
      if (gabinete && d.formatoDePlaca) {
        const entran = placasQueEntran(gabinete);
        if (entran && !entran.includes(d.formatoDePlaca)) return { estado: "incompatible", motivo: `No entra en el gabinete elegido` };
      }
      if (cpu && (!cpu.socket || !d.socket)) return { estado: "revisar", motivo: "Confirmá el socket en la ficha" };
      return OK;
    }
    case "memoria": {
      if (memoriaDePc(d.formatoDeMemoria) === false) return { estado: "incompatible", motivo: "Es memoria de notebook (SODIMM)" };
      const referencia = placa ?? cpu;
      if (referencia && referencia.memorias.length > 0 && d.memorias.length > 0 && !d.memorias.some((m) => referencia.memorias.includes(m)))
        return { estado: "incompatible", motivo: `${placa ? "La motherboard" : "El procesador"} usa ${referencia.memorias.join("/")}` };
      if (referencia && (referencia.memorias.length === 0 || d.memorias.length === 0)) return { estado: "revisar", motivo: "Confirmá DDR4 o DDR5 en la ficha" };
      return OK;
    }
    case "almacenamiento": {
      const esM2 = /m\.2|nvme/i.test(`${d.formatoDeDisco ?? ""} ${d.interfazDeDisco ?? ""}`);
      if (placa && esM2 && placa.ranurasM2 === 0) return { estado: "incompatible", motivo: "La motherboard no tiene ranuras M.2" };
      if (placa && !esM2 && placa.puertosSata === 0) return { estado: "incompatible", motivo: "La motherboard no tiene puertos SATA" };
      return OK;
    }
    case "video":
      return OK;
    case "fuente": {
      const recomendada = potenciaRecomendada(seleccion);
      if (d.potencia === null) return { estado: "revisar", motivo: "Confirmá la potencia en la ficha" };
      if (d.potencia < recomendada) return { estado: "incompatible", motivo: `Recomendamos ${recomendada} W o más` };
      return OK;
    }
    case "gabinete": {
      if (placa?.formatoDePlaca) {
        const entran = placasQueEntran(producto);
        if (entran && !entran.includes(placa.formatoDePlaca)) return { estado: "incompatible", motivo: `No entra una motherboard ${placa.formatoDePlaca}` };
        if (!entran) return { estado: "revisar", motivo: "Confirmá el formato de motherboard en la ficha" };
      }
      return OK;
    }
    case "cooler": {
      if (d.tipo && /pasta/i.test(d.tipo)) return { estado: "revisar", motivo: "Es pasta térmica, no un cooler" };
      if (cpu?.socket) return { estado: "revisar", motivo: `Confirmá en la ficha que sea compatible con ${cpu.socket}` };
      return OK;
    }
    default:
      return OK;
  }
}

export interface Chequeo {
  id: string;
  estado: EstadoDeCompatibilidad | "falta";
  texto: string;
}

/** El resumen del armado: compatibilidades cruzadas y lo que falta para que arranque. */
export function chequeosDelArmado(seleccion: Seleccion, yaTengo: IdDePaso[]): Chequeo[] {
  const salida: Chequeo[] = [];
  const cpu = seleccion.procesador ? datosDeCompatibilidad(seleccion.procesador) : null;
  const placa = seleccion.motherboard ? datosDeCompatibilidad(seleccion.motherboard) : null;
  const tiene = (paso: IdDePaso) => Boolean(seleccion[paso]) || yaTengo.includes(paso);

  for (const paso of PASOS) {
    if (paso.necesaria && !tiene(paso.id)) {
      if (paso.id === "fuente" && seleccion.gabinete && datosDeCompatibilidad(seleccion.gabinete).fuenteIncluida) continue;
      salida.push({ id: `falta-${paso.id}`, estado: "falta", texto: `Falta elegir ${paso.nombre.toLowerCase()}` });
    }
  }
  if (cpu && cpu.graficosIntegrados === false && !tiene("video"))
    salida.push({ id: "video", estado: "falta", texto: "El procesador no tiene gráficos integrados: sumá una placa de video" });
  if (cpu && cpu.coolerIncluido === false && !tiene("cooler"))
    salida.push({ id: "cooler", estado: "falta", texto: "El procesador no trae cooler: sumá uno" });

  for (const paso of PASOS) {
    const elegido = seleccion[paso.id];
    if (!elegido) continue;
    const otras: Seleccion = { ...seleccion };
    const evaluacion = evaluar(paso.id, elegido, otras);
    if (evaluacion.estado !== "compatible") salida.push({ id: `eval-${paso.id}`, estado: evaluacion.estado, texto: `${paso.nombre}: ${evaluacion.motivo}` });
  }

  if (cpu?.socket && placa?.socket && cpu.socket === placa.socket) salida.push({ id: "socket", estado: "compatible", texto: `Procesador y motherboard con socket ${cpu.socket}` });
  if (seleccion.fuente) {
    const potencia = datosDeCompatibilidad(seleccion.fuente).potencia;
    const recomendada = potenciaRecomendada(seleccion);
    if (potencia && potencia >= recomendada) salida.push({ id: "potencia", estado: "compatible", texto: `Fuente de ${potencia} W para ${recomendada} W recomendados` });
  } else if (seleccion.gabinete) {
    const g = datosDeCompatibilidad(seleccion.gabinete);
    if (g.fuenteIncluida) {
      const recomendada = potenciaRecomendada(seleccion);
      const potencia = g.potenciaDeLaFuenteIncluida;
      salida.push(
        potencia && potencia < recomendada
          ? { id: "fuente-incluida", estado: "incompatible", texto: `La fuente del gabinete (${potencia} W) queda corta: recomendamos ${recomendada} W` }
          : { id: "fuente-incluida", estado: "compatible", texto: "El gabinete trae fuente" },
      );
    }
  }
  return salida;
}
