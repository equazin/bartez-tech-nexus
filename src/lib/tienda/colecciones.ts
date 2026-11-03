import { ORDENES, ORDENES_DE_OFERTAS, type OpcionesDeListado, type OrdenDelCatalogo } from "./catalogo";
import type { MarcaPublica } from "./portada";

/**
 * Vistas sin categoría propia (plan de página, sección 4): las ofertas, los nuevos ingresos y
 * los productos de una marca. Mismo listado que una categoría, con su propio filtro y orden.
 */
export type TipoDeColeccion = "ofertas" | "nuevos" | "marca";

export interface DefinicionDeColeccion {
  titulo: string;
  bajada: string;
  ordenes: Array<{ valor: OrdenDelCatalogo; etiqueta: string }>;
  ordenPorDefecto: OrdenDelCatalogo;
  opciones: Pick<OpcionesDeListado, "soloOfertas" | "soloConPrecio">;
  vacio: string;
}

export function definicionDeColeccion(tipo: TipoDeColeccion, marca: Pick<MarcaPublica, "nombre"> | null): DefinicionDeColeccion {
  switch (tipo) {
    case "ofertas":
      return {
        titulo: "Ofertas",
        bajada: "Precio final rebajado sobre el de lista, con IVA incluido.",
        ordenes: ORDENES_DE_OFERTAS,
        ordenPorDefecto: "ahorro",
        opciones: { soloOfertas: true },
        vacio: "Hoy no hay ofertas. Volvé pronto.",
      };
    case "nuevos":
      return {
        titulo: "Nuevos ingresos",
        bajada: "Lo último que entró al catálogo.",
        ordenes: ORDENES,
        ordenPorDefecto: "nuevos",
        opciones: { soloConPrecio: true },
        vacio: "Todavía no hay productos nuevos.",
      };
    case "marca":
    default:
      return {
        titulo: marca?.nombre ?? "Marca",
        bajada: `${marca?.nombre ?? "Esta marca"} con envío a todo el país y precios finales con IVA incluido.`,
        ordenes: ORDENES,
        ordenPorDefecto: "destacados",
        opciones: {},
        vacio: "Todavía no hay productos de esta marca.",
      };
  }
}
