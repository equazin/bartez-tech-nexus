import { describe, expect, it } from "vitest";
import { opcionesDeCategoria } from "@/lib/api/categorias";
import {
  aplanar,
  armarArbol,
  chipsDeCategoria,
  encontrarCategoria,
  etiquetaSegura,
  filtroDeCategoria,
  rutaDeCategoria,
  type FilaDeCategoria,
} from "@/lib/tienda/catalogo";

// Un recorte del árbol de la migración 117, con cantidades inventadas para la prueba.
const FILAS: FilaDeCategoria[] = [
  { id: 4, nombre: "Periféricos", slug: "perifericos", padre_id: null, cantidad: 5, nombre_corto: null, orden: 40, incluye_etiqueta: null },
  { id: 1, nombre: "Notebooks", slug: "notebooks", padre_id: null, cantidad: 3, nombre_corto: null, orden: 10, incluye_etiqueta: null },
  { id: 2, nombre: "Gaming", slug: "gaming", padre_id: null, cantidad: 4, nombre_corto: null, orden: 20, incluye_etiqueta: "gaming" },
  { id: 11, nombre: "Notebooks gamer", slug: "notebooks-gamer", padre_id: 1, cantidad: 2, nombre_corto: "Gamer", orden: 20, incluye_etiqueta: null },
  { id: 10, nombre: "Notebooks para estudiar y trabajar", slug: "notebooks-para-estudiar-y-trabajar", padre_id: 1, cantidad: 1, nombre_corto: "Para estudiar y trabajar", orden: 10, incluye_etiqueta: null },
  { id: 12, nombre: "Notebooks para crear", slug: "notebooks-para-crear", padre_id: 1, cantidad: 0, nombre_corto: "Para crear", orden: 30, incluye_etiqueta: null },
  { id: 20, nombre: "Joysticks y volantes", slug: "gaming-joysticks-y-volantes", padre_id: 2, cantidad: 1, nombre_corto: "Joysticks y volantes", orden: 10, incluye_etiqueta: null },
  { id: 40, nombre: "Teclados", slug: "perifericos-teclados", padre_id: 4, cantidad: 5, nombre_corto: "Teclados", orden: 10, incluye_etiqueta: null },
];

describe("árbol de categorías de la tienda", () => {
  const raices = armarArbol(FILAS);

  it("ordena por el orden del menú y no por el nombre", () => {
    expect(raices.map((c) => c.slug)).toEqual(["notebooks", "gaming", "perifericos"]);
    expect(raices[0].hijas.map((c) => c.slug)).toEqual(["notebooks-para-estudiar-y-trabajar", "notebooks-gamer", "notebooks-para-crear"]);
  });

  it("usa el nombre completo cuando falta el corto y marca la vista transversal", () => {
    const gaming = encontrarCategoria(raices, "gaming");
    expect(gaming?.nombre_corto).toBe("Gaming");
    expect(gaming?.incluye_etiqueta).toBe("gaming");
    expect(encontrarCategoria(raices, "notebooks")?.incluye_etiqueta).toBeNull();
  });

  it("arma las migas desde la raíz", () => {
    expect(rutaDeCategoria(raices, 11).map((c) => c.nombre)).toEqual(["Notebooks", "Notebooks gamer"]);
  });

  it("aplana en el orden del menú, madre antes que hijas", () => {
    expect(aplanar(raices).map((c) => c.id)).toEqual([1, 10, 11, 12, 2, 20, 4, 40]);
  });
});

describe("filtro de una categoría", () => {
  const raices = armarArbol(FILAS);
  const notebooks = encontrarCategoria(raices, "notebooks")!;
  const gaming = encontrarCategoria(raices, "gaming")!;
  const teclados = encontrarCategoria(raices, "perifericos-teclados")!;

  it("una categoría común trae su rama", () => {
    expect(filtroDeCategoria(notebooks)).toEqual({ categoriaIds: [1, 10, 11, 12], etiqueta: null, unirConEtiqueta: false });
  });

  it("Gaming trae su rama o lo que lleva la etiqueta", () => {
    expect(filtroDeCategoria(gaming)).toEqual({ categoriaIds: [2, 20], etiqueta: "gaming", unirConEtiqueta: true });
  });

  it("Gaming filtrado por Teclados trae solo los teclados con la etiqueta", () => {
    expect(filtroDeCategoria(gaming, teclados)).toEqual({ categoriaIds: [40], etiqueta: "gaming", unirConEtiqueta: false });
  });

  it("una subcategoría no cambia el filtro de una categoría común", () => {
    expect(filtroDeCategoria(notebooks, teclados).categoriaIds).toEqual([1, 10, 11, 12]);
  });

  it("no acepta etiquetas que romperían el filtro de PostgREST", () => {
    expect(etiquetaSegura(" Gaming ")).toBe("gaming");
    expect(etiquetaSegura("gaming),id.gt.(0")).toBeNull();
    expect(etiquetaSegura("")).toBeNull();
  });
});

describe("chips de subcategoría", () => {
  const raices = armarArbol(FILAS);

  it("en una categoría común muestra las hijas con productos y su nombre corto", () => {
    const chips = chipsDeCategoria(raices, encontrarCategoria(raices, "notebooks")!);
    expect(chips.map((c) => c.etiqueta)).toEqual(["Para estudiar y trabajar", "Gamer"]);
  });

  it("en Gaming muestra primero sus propias subcategorías y después las de otras ramas, con el nombre completo", () => {
    const conteo = new Map([
      [20, 1],
      [11, 2],
      [40, 3],
    ]);
    const chips = chipsDeCategoria(raices, encontrarCategoria(raices, "gaming")!, conteo);
    expect(chips.map((c) => [c.etiqueta, c.cantidad])).toEqual([
      ["Joysticks y volantes", 1],
      ["Notebooks gamer", 2],
      ["Teclados", 3],
    ]);
  });

  it("sin conteo todavía, Gaming muestra sus hijas como una categoría común", () => {
    const chips = chipsDeCategoria(raices, encontrarCategoria(raices, "gaming")!);
    expect(chips.map((c) => c.categoria.slug)).toEqual(["gaming-joysticks-y-volantes"]);
  });
});

describe("opciones de categoría en el panel", () => {
  it("lista solo las activas, en el orden del menú y con la madre delante", () => {
    const opciones = opcionesDeCategoria([
      { id: 1, name: "Notebooks", parent_id: null, active: true, orden: 10 },
      { id: 11, name: "Notebooks gamer", parent_id: 1, active: true, orden: 20 },
      { id: 10, name: "Notebooks para estudiar y trabajar", parent_id: 1, active: true, orden: 10 },
      { id: 3, name: "Monitores", parent_id: null, active: true, orden: 30 },
      { id: 9, name: "Punto de Venta", parent_id: null, active: false, orden: 100 },
      { id: 90, name: "Huérfana", parent_id: 9, active: true, orden: 100 },
    ]);
    expect(opciones.map((o) => o.etiqueta)).toEqual([
      "Notebooks",
      "Notebooks › Notebooks para estudiar y trabajar",
      "Notebooks › Notebooks gamer",
      "Monitores",
      "Huérfana (fuera del menú)",
    ]);
  });
});
