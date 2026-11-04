import Papa from "papaparse";

/**
 * CSV del catálogo de ida y vuelta: el panel exporta estas columnas y el importador
 * acepta las mismas, así un producto se completa entero desde una planilla.
 *
 * Reglas de cada celda:
 *   - vacía: no cambia ese dato;
 *   - un guion (-): borra ese dato;
 *   - cualquier otro valor: lo reemplaza.
 * Solo el SKU es obligatorio. Un SKU que no existe crea el producto (y entonces pide
 * nombre y costo); uno que existe actualiza solo las columnas que traen algo.
 */

export interface ColumnaDelCsv {
  columna: string;
  ayuda: string;
}

export const COLUMNAS_CSV: ColumnaDelCsv[] = [
  { columna: "sku", ayuda: "Obligatorio. Identifica el producto; si no existe, se crea." },
  { columna: "nombre", ayuda: "El nombre que se ve en la tienda." },
  { columna: "marca", ayuda: "Si coincide con una marca del panel, queda vinculada." },
  { columna: "categoria", ayuda: "Nombre o slug de una categoría de Teqo, por ejemplo Monitores para jugar." },
  { columna: "descripcion_corta", ayuda: "La línea debajo del título, hasta 300 caracteres." },
  { columna: "descripcion", ayuda: "El texto de la ficha. Cada salto de línea es un párrafo." },
  { columna: "ficha_tecnica", ayuda: "Pares Clave: valor separados por |, en el orden en que se muestran." },
  { columna: "fotos", ayuda: "Direcciones de las fotos separadas por |. La primera es la principal." },
  { columna: "peso_kg", ayuda: "Peso con caja, para calcular el envío." },
  { columna: "costo_usd", ayuda: "Costo sin IVA en dólares. En productos de mayoristas lo actualiza la sincronización." },
  { columna: "iva", ayuda: "Alícuota: 10,5 o 21." },
  { columna: "oferta_porcentaje", ayuda: "Descuento sobre el precio de lista. 0 la saca." },
  { columna: "stock", ayuda: "Unidades. En productos de mayoristas lo actualiza la sincronización." },
  { columna: "etiquetas", ayuda: "Separadas por coma." },
  { columna: "destacado", ayuda: "si o no. Aparece en Destacados de la portada." },
  { columna: "publicado", ayuda: "si o no. Visible en la tienda." },
  { columna: "activo", ayuda: "si o no. Un producto inactivo no existe para la tienda." },
];

/** Nombres de columnas del importador anterior que se siguen aceptando. */
const ALIAS: Record<string, string> = {
  name: "nombre",
  description: "descripcion",
  image: "fotos",
  category: "categoria",
  cost_price: "costo_usd",
  featured: "destacado",
  active: "activo",
  tags: "etiquetas",
  supplier_multiplier: "multiplicador",
  iva_rate: "iva",
  weight_kg: "peso_kg",
};

/** Columnas que se aceptan al importar aunque no se exporten. */
const SOLO_IMPORTACION = new Set(["multiplicador", "stock_min", "external_id"]);

const CONOCIDAS = new Set([...COLUMNAS_CSV.map((c) => c.columna), ...SOLO_IMPORTACION]);

/** Claves de specs que son del mayorista o de uso interno: no se exportan ni se muestran. */
const SPECS_INTERNAS = [
  /cost/i, /costo/i, /markup/i, /margen/i, /pvp/i, /exchange/i, /cotizacion/i, /precio/i,
  /^elit_/i, /^air_/i, /^invid_/i, /^nb_/i, /^supplier_/i, /^preferred_supplier_/i, /^sync_/i, /^internal_/i,
  /^provider_/i, /token/i, /uuid/i, /external_id/i, /source/i, /last_update/i, /^images$/i, /^gallery$/i,
  /^ean$/i, /^manufacturer_part_number$/i, /^weight_kg$/i,
];

export interface CategoriaDelCsv {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

export interface MarcaDelCsv {
  id: string;
  name: string;
}

export interface ParFicha {
  clave: string;
  valor: string;
}

export interface FilaInterpretada {
  fila: number;
  sku: string;
  cambios: Record<string, unknown>;
  errores: string[];
}

const BORRAR = "-";

function normalizarEncabezado(encabezado: string): string {
  const limpio = encabezado
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return ALIAS[limpio] ?? limpio;
}

function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Número en formato argentino (1.234,56) o internacional (1234.56). */
export function leerNumero(valor: string): number | null {
  let texto = valor.trim().replace(/\s/g, "").replace(/^\$|^USD|^US\$/i, "");
  if (texto === "") return null;
  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.lastIndexOf(",") > texto.lastIndexOf(".") ? texto.replace(/\./g, "").replace(",", ".") : texto.replace(/,/g, "");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

function leerBooleano(valor: string): boolean | null {
  const texto = sinAcentos(valor);
  if (["si", "s", "true", "1", "x", "yes"].includes(texto)) return true;
  if (["no", "n", "false", "0"].includes(texto)) return false;
  return null;
}

function leerLista(valor: string, separador: RegExp): string[] {
  return valor
    .split(separador)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

export function leerFicha(valor: string): { pares: ParFicha[]; errores: string[] } {
  const pares: ParFicha[] = [];
  const errores: string[] = [];
  for (const parte of leerLista(valor, /\|/)) {
    const separador = parte.indexOf(":");
    if (separador <= 0) {
      errores.push(`la ficha técnica tiene "${parte}" sin el formato Clave: valor`);
      continue;
    }
    const clave = parte.slice(0, separador).trim();
    const dato = parte.slice(separador + 1).trim();
    if (clave && dato) pares.push({ clave, valor: dato });
  }
  return { pares, errores };
}

function escribirNumero(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "";
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "";
  return Number.isInteger(numero) ? String(numero) : String(numero).replace(".", ",");
}

function escribirBooleano(valor: unknown): string {
  return valor === true ? "si" : "no";
}

function specsPublicas(specs: unknown): ParFicha[] {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return [];
  return Object.entries(specs as Record<string, unknown>)
    .filter(([clave, valor]) => !SPECS_INTERNAS.some((patron) => patron.test(clave)) && valor !== null && valor !== "")
    .map(([clave, valor]) => ({ clave, valor: Array.isArray(valor) ? valor.join(", ") : String(valor) }));
}

function fichaDe(producto: Record<string, unknown>): ParFicha[] {
  const ficha = producto.ficha;
  if (Array.isArray(ficha) && ficha.length > 0) {
    return ficha
      .filter((par): par is ParFicha => Boolean(par) && typeof par === "object" && "clave" in par && "valor" in par)
      .map((par) => ({ clave: String(par.clave), valor: String(par.valor) }));
  }
  return specsPublicas(producto.specs);
}

/** Interpreta las filas del CSV contra las categorías y marcas del panel. */
export function interpretarCsv(
  texto: string,
  categorias: CategoriaDelCsv[],
  marcas: MarcaDelCsv[],
): { filas: FilaInterpretada[]; columnasIgnoradas: string[]; errorGeneral: string | null } {
  const resultado = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizarEncabezado,
  });

  const encabezados = resultado.meta.fields ?? [];
  if (!encabezados.includes("sku")) {
    return { filas: [], columnasIgnoradas: [], errorGeneral: "El archivo no tiene la columna sku." };
  }
  const columnasIgnoradas = encabezados.filter((c) => c && !CONOCIDAS.has(c));

  const categoriaPorClave = new Map<string, CategoriaDelCsv>();
  for (const categoria of categorias.filter((c) => c.active)) {
    categoriaPorClave.set(sinAcentos(categoria.name), categoria);
    categoriaPorClave.set(categoria.slug.toLowerCase(), categoria);
  }
  const marcaPorNombre = new Map(marcas.map((m) => [sinAcentos(m.name), m]));

  const filas = resultado.data.map((crudo, indice): FilaInterpretada => {
    const fila = indice + 2;
    const celda = (columna: string) => (crudo[columna] ?? "").toString().trim();
    const sku = celda("sku").toUpperCase();
    const cambios: Record<string, unknown> = {};
    const errores: string[] = [];

    if (!sku) return { fila, sku: "", cambios, errores: ["falta el SKU"] };

    const texto = (columna: string, destino: string, maximo: number) => {
      const valor = celda(columna);
      if (valor === "") return;
      if (valor === BORRAR) { cambios[destino] = null; return; }
      if (valor.length > maximo) { errores.push(`${columna} supera los ${maximo} caracteres`); return; }
      cambios[destino] = valor;
    };

    const numero = (columna: string, destino: string, validar: (n: number) => boolean, mensaje: string, borrable = true) => {
      const valor = celda(columna);
      if (valor === "") return;
      if (valor === BORRAR) {
        if (borrable) cambios[destino] = null;
        else errores.push(`${columna} no se puede borrar`);
        return;
      }
      const n = leerNumero(valor);
      if (n === null || !validar(n)) { errores.push(`${columna}: ${mensaje}`); return; }
      cambios[destino] = n;
    };

    const booleano = (columna: string, destino: string) => {
      const valor = celda(columna);
      if (valor === "") return;
      const b = leerBooleano(valor);
      if (b === null) { errores.push(`${columna}: poné si o no`); return; }
      cambios[destino] = b;
    };

    // Nombre visible
    texto("nombre", "name_custom", 200);

    // Marca
    const marca = celda("marca");
    if (marca === BORRAR) {
      cambios.brand_name = null;
      cambios.brand_id = null;
    } else if (marca !== "") {
      const vinculada = marcaPorNombre.get(sinAcentos(marca));
      cambios.brand_name = vinculada?.name ?? marca;
      cambios.brand_id = vinculada?.id ?? null;
    }

    // Categoría de Teqo
    const categoria = celda("categoria");
    if (categoria === BORRAR) {
      cambios.category_id = null;
    } else if (categoria !== "") {
      const encontrada = categoriaPorClave.get(sinAcentos(categoria)) ?? categoriaPorClave.get(categoria.toLowerCase());
      if (encontrada) {
        cambios.category = encontrada.name;
        cambios.category_id = encontrada.id;
      } else {
        errores.push(`no existe la categoría "${categoria}"`);
      }
    }

    texto("descripcion_corta", "description_short", 300);
    texto("descripcion", "description_full", 20_000);
    // La tienda muestra description_full y, si está vacía, la descripción que trajo el mayorista.
    // Borrar tiene que vaciar las dos para que no vuelva a aparecer el texto del mayorista.
    if (celda("descripcion") === BORRAR) cambios.description = "";

    // Ficha técnica
    const ficha = celda("ficha_tecnica");
    if (ficha === BORRAR) {
      cambios.ficha = [];
    } else if (ficha !== "") {
      const leida = leerFicha(ficha);
      errores.push(...leida.errores);
      if (leida.errores.length === 0) cambios.ficha = leida.pares;
    }

    // Fotos: la primera es la principal
    const fotos = celda("fotos");
    if (fotos === BORRAR) {
      cambios.images = [];
      cambios.image = null;
    } else if (fotos !== "") {
      const lista = leerLista(fotos, /\|/);
      const invalidas = lista.filter((url) => !/^https?:\/\//i.test(url) && !url.startsWith("/"));
      if (invalidas.length > 0) {
        errores.push(`fotos: "${invalidas[0]}" no es una dirección válida`);
      } else {
        cambios.images = lista;
        cambios.image = lista[0];
      }
    }

    numero("peso_kg", "weight_kg", (n) => n >= 0 && n <= 200, "tiene que ser un número entre 0 y 200");
    numero("costo_usd", "cost_price", (n) => n > 0, "tiene que ser un número mayor que 0", false);
    numero("iva", "iva_rate", (n) => [0, 10.5, 21, 27].includes(n), "tiene que ser 0, 10,5, 21 o 27", false);
    numero("multiplicador", "supplier_multiplier", (n) => n > 0 && n < 10, "tiene que ser un número entre 0 y 10", false);
    numero("stock_min", "stock_min", (n) => Number.isInteger(n) && n >= 0, "tiene que ser un entero", false);

    const oferta = celda("oferta_porcentaje");
    if (oferta === BORRAR) {
      cambios.offer_percent = null;
    } else if (oferta !== "") {
      const n = leerNumero(oferta.replace("%", ""));
      if (n === null || n < 0 || n >= 90) errores.push("oferta_porcentaje: tiene que ser un número entre 0 y 89");
      else cambios.offer_percent = n === 0 ? null : n;
    }

    numero("stock", "stock", (n) => Number.isInteger(n) && n >= 0, "tiene que ser un entero mayor o igual a 0", false);

    const etiquetas = celda("etiquetas");
    if (etiquetas === BORRAR) cambios.tags = [];
    else if (etiquetas !== "") cambios.tags = leerLista(etiquetas, /,/);

    const externo = celda("external_id");
    if (externo === BORRAR) cambios.external_id = null;
    else if (externo !== "") cambios.external_id = externo;

    booleano("destacado", "featured");
    booleano("publicado", "publicado");
    booleano("activo", "active");

    return { fila, sku, cambios, errores };
  });

  return { filas, columnasIgnoradas, errorGeneral: null };
}

/** CSV del catálogo con las mismas columnas que acepta el importador, separado por punto y coma para Excel. */
export function exportarCatalogoCsv(
  productos: Array<Record<string, unknown>>,
  categorias: Array<{ id: number; name: string; active?: boolean | null }>,
): string {
  const categoriaPorId = new Map(categorias.filter((c) => c.active !== false).map((c) => [c.id, c.name]));
  const filas = productos.map((p) => {
    const specs = (p.specs ?? {}) as Record<string, unknown>;
    const imagenes = Array.isArray(p.images) ? (p.images as unknown[]).map(String).filter(Boolean) : [];
    const fotos = imagenes.length > 0 ? imagenes : p.image ? [String(p.image)] : [];
    return {
      sku: p.sku ?? "",
      nombre: p.name_custom ?? p.name_original ?? p.name ?? "",
      marca: p.brand_name ?? (typeof specs.supplier_brand === "string" ? specs.supplier_brand : ""),
      categoria: typeof p.category_id === "number" ? categoriaPorId.get(p.category_id) ?? "" : "",
      descripcion_corta: p.description_short ?? "",
      descripcion: p.description_full ?? p.description ?? "",
      ficha_tecnica: fichaDe(p).map((par) => `${par.clave}: ${par.valor}`).join(" | "),
      fotos: fotos.join(" | "),
      peso_kg: escribirNumero(p.weight_kg),
      costo_usd: escribirNumero(p.cost_price),
      iva: escribirNumero(p.iva_rate ?? 21),
      oferta_porcentaje: escribirNumero(p.offer_percent),
      stock: escribirNumero(p.stock ?? 0),
      etiquetas: Array.isArray(p.tags) ? (p.tags as unknown[]).join(", ") : "",
      destacado: escribirBooleano(p.featured),
      publicado: escribirBooleano(p.publicado),
      activo: escribirBooleano(p.active !== false),
    };
  });
  return Papa.unparse(filas, { delimiter: ";", columns: COLUMNAS_CSV.map((c) => c.columna) });
}

/** Planilla vacía con una fila de ejemplo de formato. */
export function plantillaCsv(): string {
  return Papa.unparse(
    [
      {
        sku: "EJEMPLO-001",
        nombre: "Monitor de ejemplo 27 pulgadas",
        marca: "LG",
        categoria: "Monitores para jugar",
        descripcion_corta: "Monitor de 27 pulgadas para jugar y trabajar.",
        descripcion: "Primer párrafo de la descripción.",
        ficha_tecnica: "Pantalla: 27 pulgadas | Resolución: 2560 × 1440 | Frecuencia: 165 Hz",
        fotos: "https://ejemplo.com/foto-1.jpg | https://ejemplo.com/foto-2.jpg",
        peso_kg: "6,2",
        costo_usd: "200",
        iva: "21",
        oferta_porcentaje: "",
        stock: "5",
        etiquetas: "gaming, 165 hz",
        destacado: "no",
        publicado: "no",
        activo: "si",
      },
    ],
    { delimiter: ";", columns: COLUMNAS_CSV.map((c) => c.columna) },
  );
}
