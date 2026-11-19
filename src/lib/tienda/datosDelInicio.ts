import type { PortadaPublica } from "./portadas";
import { normalizarSeccion, type SeccionCruda, type SeccionDelInicio } from "./seccionesInicio";

/**
 * Lo que el inicio necesita para dibujarse apenas arranca la aplicación: las secciones y las portadas.
 * scripts/prerender.mjs las deja escritas en el HTML del inicio (un <script type="application/json"> con este id),
 * así la portada no espera a dos consultas a la base. Son las del último despliegue: el inicio las vuelve a pedir
 * al montarse y corrige lo que haya cambiado. Solo están si la página se abrió por el inicio; lo que se lee después
 * se recuerda acá, para que volver al inicio tampoco espere.
 */
const ID_DE_LOS_DATOS = "datos-del-inicio";

interface DatosDelInicio {
  secciones?: SeccionDelInicio[];
  portadas?: PortadaPublica[];
}

let datos: DatosDelInicio | undefined;

function leerLosEscritos(): DatosDelInicio {
  try {
    const texto = document.getElementById(ID_DE_LOS_DATOS)?.textContent;
    if (!texto) return {};
    const crudo = JSON.parse(texto) as { secciones?: unknown; portadas?: unknown };
    return {
      ...(Array.isArray(crudo.secciones) ? { secciones: (crudo.secciones as SeccionCruda[]).map(normalizarSeccion) } : {}),
      ...(Array.isArray(crudo.portadas) ? { portadas: crudo.portadas as PortadaPublica[] } : {}),
    };
  } catch {
    // Sin datos escritos, o ilegibles: el inicio los pide como siempre.
    return {};
  }
}

function conocidos(): DatosDelInicio {
  datos = datos ?? leerLosEscritos();
  return datos;
}

/** Las secciones del inicio tal como están en la base (puede ser una lista vacía), o null si todavía no se saben. */
export const seccionesConocidas = (): SeccionDelInicio[] | null => conocidos().secciones ?? null;

export const portadasConocidas = (): PortadaPublica[] | undefined => conocidos().portadas;

export function recordarSecciones(secciones: SeccionDelInicio[]): void {
  datos = { ...conocidos(), secciones };
}

export function recordarPortadas(portadas: PortadaPublica[]): void {
  datos = { ...conocidos(), portadas };
}

/** Para no volver a dibujar lo que ya está en pantalla cuando la base devuelve lo mismo que vino escrito. */
export const sonIguales = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
