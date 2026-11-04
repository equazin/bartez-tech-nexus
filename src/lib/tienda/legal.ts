import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface DatosLegales {
  razon_social: string | null;
  cuit: string | null;
  domicilio: string | null;
  email: string | null;
  telefono: string | null;
  data_fiscal_url: string | null;
}

export interface ContenidoLegal {
  datos_legales: DatosLegales;
  texto_terminos: string | null;
  texto_privacidad: string | null;
  texto_garantias: string | null;
}

const VACIO: ContenidoLegal = {
  datos_legales: { razon_social: null, cuit: null, domicilio: null, email: null, telefono: null, data_fiscal_url: null },
  texto_terminos: null,
  texto_privacidad: null,
  texto_garantias: null,
};

let enMemoria: Promise<ContenidoLegal> | null = null;

/** Los datos del vendedor y los textos legales, una sola vez por visita. */
export function contenidoLegal(): Promise<ContenidoLegal> {
  if (!enMemoria) {
    enMemoria = supabase
      .rpc("tienda_contenido_legal")
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        const crudo = (data ?? {}) as Partial<ContenidoLegal>;
        return {
          datos_legales: { ...VACIO.datos_legales, ...(crudo.datos_legales ?? {}) },
          texto_terminos: typeof crudo.texto_terminos === "string" ? crudo.texto_terminos : null,
          texto_privacidad: typeof crudo.texto_privacidad === "string" ? crudo.texto_privacidad : null,
          texto_garantias: typeof crudo.texto_garantias === "string" ? crudo.texto_garantias : null,
        };
      })
      .catch(() => {
        enMemoria = null;
        return VACIO;
      });
  }
  return enMemoria;
}

export function useContenidoLegal(): ContenidoLegal {
  const [contenido, setContenido] = useState<ContenidoLegal>(VACIO);
  useEffect(() => {
    let cancelado = false;
    contenidoLegal().then((c) => {
      if (!cancelado) setContenido(c);
    });
    return () => {
      cancelado = true;
    };
  }, []);
  return contenido;
}

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
 * la reparación no queda bien, cambio, devolución o rebaja (art. 17).
 */
export const GARANTIAS_POR_DEFECTO: string[] = [
  "Todos los productos son nuevos, en su caja original y con la configuración de fábrica.",
  "Cada producto tiene la garantía oficial de su marca. El plazo figura en la ficha del producto y nunca es menor a 6 meses, el mínimo que fija la Ley de Defensa del Consumidor para productos nuevos.",
  "Si un producto falla dentro de la garantía, escribinos con el número de pedido y una descripción de la falla; si podés, sumá fotos o un video. Te decimos cómo seguir: según la marca, lo gestionamos nosotros o te derivamos al servicio técnico oficial, y te acompañamos hasta que se resuelva.",
  "Si hace falta mandar el producto a revisar, el envío y el seguro no corren por tu cuenta. El tiempo que el producto esté en reparación se suma al plazo de la garantía.",
  "Si la reparación no queda bien, podés elegir el cambio por otro producto igual, la devolución de lo que pagaste o una rebaja del precio.",
  "La garantía no cubre golpes, líquidos, sobretensiones, mal uso ni equipos abiertos o modificados fuera del servicio técnico oficial.",
];

/** Lo que se agrega en la página de Garantías y cambios: el arrepentimiento. */
export const CAMBIOS_POR_DEFECTO: string[] = [
  "Podés arrepentirte de la compra dentro de los 10 días corridos desde que la recibiste, sin dar motivos y sin costo para vos, con el botón de arrepentimiento: te damos un código al instante y te respondemos dentro de las 24 horas. El producto tiene que volver como lo recibiste.",
];

/** Un texto legal cargado en el panel, en párrafos; o nada si falta. */
export function parrafosDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
