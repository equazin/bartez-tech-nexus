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

/** Un texto legal cargado en el panel, en párrafos; o nada si falta. */
export function parrafosDe(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
