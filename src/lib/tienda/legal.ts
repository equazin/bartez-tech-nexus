import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import textosDeAyuda from "./ayuda.json";

export interface DatosLegales {
  razon_social: string | null;
  cuit: string | null;
  domicilio: string | null;
  email: string | null;
  telefono: string | null;
  /** Cuándo se atiende, tal como se muestra: "Lunes a viernes, de 9 a 18". */
  horario: string | null;
  data_fiscal_url: string | null;
}

export interface ContenidoLegal {
  datos_legales: DatosLegales;
  texto_terminos: string | null;
  texto_privacidad: string | null;
  texto_garantias: string | null;
}

/** "cargando": todavía no respondió la base. "sin-leer": no se pudo leer. "listo": es lo que hay cargado en el panel. */
export type EstadoDelContenido = "cargando" | "listo" | "sin-leer";

export interface ContenidoLegalLeido extends ContenidoLegal {
  estado: EstadoDelContenido;
}

const VACIO: ContenidoLegal = {
  datos_legales: { razon_social: null, cuit: null, domicilio: null, email: null, telefono: null, horario: null, data_fiscal_url: null },
  texto_terminos: null,
  texto_privacidad: null,
  texto_garantias: null,
};

/**
 * El id del <script> con el contenido legal que scripts/prerender.mjs deja en Términos, Privacidad, Garantías y Ayuda:
 * si cambia uno, cambiar el otro.
 */
const ID_DEL_CONTENIDO = "datos-legales";

const textoO = (valor: unknown): string | null => (typeof valor === "string" ? valor : null);

function normalizar(crudo: Partial<ContenidoLegal>): ContenidoLegal {
  return {
    datos_legales: { ...VACIO.datos_legales, ...(crudo.datos_legales ?? {}) },
    texto_terminos: textoO(crudo.texto_terminos),
    texto_privacidad: textoO(crudo.texto_privacidad),
    texto_garantias: textoO(crudo.texto_garantias),
  };
}

/** El contenido que la página trae escrito (el del último despliegue), o null. */
function contenidoEscrito(): ContenidoLegal | null {
  if (typeof document === "undefined") return null;
  try {
    const texto = document.getElementById(ID_DEL_CONTENIDO)?.textContent;
    return texto ? normalizar(JSON.parse(texto) as Partial<ContenidoLegal>) : null;
  } catch {
    // Sin contenido escrito, o ilegible: se pide a la base como siempre.
    return null;
  }
}

/**
 * El id del <script> con los datos de la tienda (CUIT, domicilio, contacto, Data Fiscal) que scripts/prerender.mjs
 * deja en todas las páginas, sin los textos legales: si cambia uno, cambiar el otro. Con eso el pie los dibuja sin
 * esperar a la base.
 */
const ID_DE_LOS_DATOS = "datos-de-la-tienda";

/** Los datos de la tienda que la página trae escritos, o null. */
function datosEscritos(): DatosLegales | null {
  if (typeof document === "undefined") return null;
  try {
    const texto = document.getElementById(ID_DE_LOS_DATOS)?.textContent;
    return texto ? { ...VACIO.datos_legales, ...(JSON.parse(texto) as Partial<DatosLegales>) } : null;
  } catch {
    return null;
  }
}

/** Lo último que se supo: lo que vino escrito en la página o lo que respondió la base. `undefined`: todavía no se miró. */
let conocido: ContenidoLegal | null | undefined;
let datosSabidos: DatosLegales | null | undefined;
let enMemoria: Promise<ContenidoLegal | null> | null = null;

function contenidoConocido(): ContenidoLegal | null {
  if (conocido === undefined) conocido = contenidoEscrito();
  return conocido;
}

function datosConocidos(): DatosLegales | null {
  if (datosSabidos === undefined) datosSabidos = datosEscritos();
  return datosSabidos;
}

/** Los datos del vendedor y los textos legales, una sola vez por visita. Null si no se pudieron leer. */
function pedirContenido(): Promise<ContenidoLegal | null> {
  if (!enMemoria) {
    // Promise.resolve: la consulta de Supabase es "thenable" pero no una promesa completa (no tiene catch).
    enMemoria = Promise.resolve(supabase.rpc("tienda_contenido_legal"))
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        conocido = normalizar((data ?? {}) as Partial<ContenidoLegal>);
        return conocido;
      })
      .catch(() => {
        enMemoria = null;
        return null;
      });
  }
  return enMemoria;
}

/** Los datos del vendedor y los textos legales. Si la base no responde, lo que traía la página o todo vacío. */
export function contenidoLegal(): Promise<ContenidoLegal> {
  return pedirContenido().then((leido) => leido ?? contenidoConocido() ?? VACIO);
}

/**
 * El contenido legal para dibujar. Las páginas legales y Ayuda lo traen escrito, así el texto está desde el primer
 * dibujo; después se vuelve a pedir y se corrige si cambió. `estado` separa "todavía no llegó" de "no hay nada
 * cargado": mientras carga no se muestra un texto de relleno que no es el de la tienda.
 */
export function useContenidoLegal(): ContenidoLegalLeido {
  const [leido, setLeido] = useState<ContenidoLegalLeido>(() => {
    const previo = contenidoConocido();
    if (previo) return { ...previo, estado: "listo" };
    // Sin los textos pero con los datos de la tienda escritos en la página: el pie ya tiene qué mostrar.
    const datos = datosConocidos();
    return { ...VACIO, ...(datos ? { datos_legales: datos } : {}), estado: "cargando" };
  });
  useEffect(() => {
    let cancelado = false;
    pedirContenido().then((contenido) => {
      if (cancelado) return;
      if (!contenido) {
        // No respondió: lo que ya estaba en pantalla se queda; si no había nada, se avisa.
        setLeido((antes) => (antes.estado === "listo" ? antes : { ...antes, estado: "sin-leer" }));
        return;
      }
      const nuevo: ContenidoLegalLeido = { ...contenido, estado: "listo" };
      setLeido((antes) => (JSON.stringify(antes) === JSON.stringify(nuevo) ? antes : nuevo));
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return leido;
}

/** El enlace de WhatsApp del teléfono de la tienda, o null si no hay teléfono cargado. */
export function enlaceDeWhatsApp(telefono: string | null): string | null {
  const numero = telefono?.replace(/\D/g, "") ?? "";
  return numero ? `https://wa.me/${numero}` : null;
}

/** "Lunes a viernes, de 9 a 18" pasa a "lunes a viernes, de 9 a 18", para seguir una frase. */
export const enMinuscula = (texto: string): string => texto.charAt(0).toLowerCase() + texto.slice(1);

export interface ArrepentimientoNuevo {
  email: string;
  numero?: string;
  motivo?: string;
  nombre?: string;
}

export async function crearArrepentimiento(datos: ArrepentimientoNuevo): Promise<{ codigo: string; numero: string | null }> {
  const respuesta = await fetch("/api/legal?recurso=arrepentimiento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  const json = (await respuesta.json().catch(() => ({}))) as { data?: { codigo: string; numero: string | null }; error?: string };
  if (!respuesta.ok || !json.data) throw new Error(json.error ?? "No se pudo registrar el arrepentimiento.");
  return json.data;
}

/**
 * Garantías mientras el panel no tenga un texto propio. Se apoya en la Ley 24.240: mínimo de 6 meses en productos
 * nuevos, el traslado a cargo del responsable de la garantía, el tiempo en reparación suma al plazo (art. 16) y, si
 * la reparación no queda bien, cambio, devolución o rebaja (art. 17). El texto vive en ayuda.json, que también lee
 * scripts/prerender.mjs para escribirlo en el HTML.
 */
export const GARANTIAS_POR_DEFECTO: string[] = textosDeAyuda.garantias;

/** Lo que se agrega en la página de Garantías y cambios: el arrepentimiento. */
export const CAMBIOS_POR_DEFECTO: string[] = textosDeAyuda.cambios;

/** Un texto legal cargado en el panel, en párrafos; o nada si falta. */
export function parrafosDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
