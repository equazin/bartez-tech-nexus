import { describe, expect, it } from "vitest";
import { armarArbol, type ProductoPublico } from "@/lib/tienda/catalogo";
import { definicionDeColeccion } from "@/lib/tienda/colecciones";
import { ACCESOS_DIRECTOS, accesosConProductos, leerPortada, marcasPresentes, promesasDeConfianza } from "@/lib/tienda/portada";

function producto(parcial: Partial<ProductoPublico>): ProductoPublico {
  return {
    id: 1,
    slug: "p-1",
    nombre: "Producto",
    descripcion_corta: null,
    descripcion: null,
    imagenes: [],
    imagen: null,
    categoria_nombre: null,
    categoria_id: null,
    categoria_slug: null,
    marca_id: null,
    marca: null,
    hay_stock: true,
    pocas_unidades: false,
    sku: null,
    iva_rate: 21,
    precio_final_ars: 1000,
    precio_lista_ars: null,
    oferta: false,
    tags: null,
    peso_kg: null,
    destacado: false,
    specs: null,
    etiquetas: [],
    creado_en: null,
    nuevo: false,
    ahorro_pct: null,
    ...parcial,
  };
}

describe("leerPortada", () => {
  it("toma el elegido con sus datos y razones, recortados a cuatro y tres", () => {
    const portada = leerPortada({
      elegido: { producto: producto({ id: 7 }), datos: ["a", " b ", "", "c", "d", "e"], razones: ["uno", "dos", "tres", "cuatro"], desde: "2026-11-03" },
      garantia_meses: 12,
      cuotas_maximas: 6,
    });
    expect(portada.elegido?.producto.id).toBe(7);
    expect(portada.elegido?.datos).toEqual(["a", "b", "c", "d"]);
    expect(portada.elegido?.razones).toEqual(["uno", "dos", "tres"]);
    expect(portada.garantia_meses).toBe(12);
    expect(portada.cuotas_maximas).toBe(6);
  });

  it("sin razones o sin producto, no hay elegido", () => {
    expect(leerPortada({ elegido: { producto: producto({}), razones: [] } }).elegido).toBeNull();
    expect(leerPortada({ elegido: { producto: null, razones: ["x"] } }).elegido).toBeNull();
  });

  it("cualquier cosa rara se lee como portada vacía", () => {
    expect(leerPortada(null)).toEqual({ elegido: null, garantia_meses: null, cuotas_maximas: null });
    expect(leerPortada({ garantia_meses: "12", cuotas_maximas: Number.NaN }).garantia_meses).toBeNull();
  });
});

describe("promesasDeConfianza", () => {
  it("son cuatro, en el orden de la franja", () => {
    expect(promesasDeConfianza({ garantia_meses: 12, cuotas_maximas: 12 }).map((p) => p.clave)).toEqual(["envio", "garantia", "cuotas", "arrepentimiento"]);
  });

  it("con datos del panel, usa los números", () => {
    const [, garantia, cuotas] = promesasDeConfianza({ garantia_meses: 12, cuotas_maximas: 6 });
    expect(garantia.titulo).toBe("Garantía de 12 meses");
    expect(cuotas.titulo).toBe("Hasta 6 cuotas");
    expect(promesasDeConfianza({ garantia_meses: 1, cuotas_maximas: null })[1].titulo).toBe("Garantía de 1 mes");
  });

  it("sin datos, la garantía va con marcador y las cuotas sin número inventado", () => {
    const [, garantia, cuotas] = promesasDeConfianza({ garantia_meses: null, cuotas_maximas: null });
    expect(garantia.titulo).toBe("Garantía de [N] meses");
    expect(cuotas.titulo).toBe("Cuotas con Mercado Pago");
  });

  it("no usa signos de exclamación ni ciudades", () => {
    const textos = promesasDeConfianza({ garantia_meses: null, cuotas_maximas: null }).flatMap((p) => [p.titulo, p.texto]);
    for (const texto of textos) {
      expect(texto).not.toMatch(/[!¡]/);
      expect(texto).not.toMatch(/Rosario|Buenos Aires|CABA|Córdoba/);
    }
  });
});

describe("accesos directos", () => {
  it("son diez", () => {
    expect(ACCESOS_DIRECTOS).toHaveLength(10);
  });

  it("muestra solo los que tienen productos, en el orden de la lista", () => {
    const raices = armarArbol([
      { id: 1, nombre: "Notebooks", slug: "notebooks", padre_id: null, cantidad: 3 },
      { id: 11, nombre: "Notebooks gamer", slug: "notebooks-gamer", padre_id: 1, cantidad: 2 },
      { id: 10, nombre: "Notebooks para estudiar y trabajar", slug: "notebooks-para-estudiar-y-trabajar", padre_id: 1, cantidad: 0 },
      { id: 4, nombre: "Periféricos", slug: "perifericos", padre_id: null, cantidad: 4 },
      { id: 41, nombre: "Mouse", slug: "perifericos-mouse", padre_id: 4, cantidad: 1 },
      { id: 40, nombre: "Teclados", slug: "perifericos-teclados", padre_id: 4, cantidad: 3 },
    ]);
    expect(accesosConProductos(raices)).toEqual([
      { slug: "notebooks-gamer", etiqueta: "Notebooks gamer", cantidad: 2 },
      { slug: "perifericos-teclados", etiqueta: "Teclados", cantidad: 3 },
      { slug: "perifericos-mouse", etiqueta: "Mouse", cantidad: 1 },
    ]);
  });
});

describe("marcasPresentes", () => {
  it("ordena por cuántas veces aparece y respeta el tope", () => {
    const productos = [
      producto({ id: 1, marca_id: "a", marca: "ASUS" }),
      producto({ id: 2, marca_id: "l", marca: "Logitech" }),
      producto({ id: 3, marca_id: "l", marca: "Logitech" }),
      producto({ id: 4, marca_id: null, marca: "Sin id" }),
      producto({ id: 5, marca_id: "h", marca: "HP" }),
    ];
    expect(marcasPresentes(productos)).toEqual([
      { id: "l", nombre: "Logitech" },
      { id: "a", nombre: "ASUS" },
      { id: "h", nombre: "HP" },
    ]);
    expect(marcasPresentes(productos, 1)).toEqual([{ id: "l", nombre: "Logitech" }]);
  });
});

describe("colecciones", () => {
  it("las ofertas filtran por oferta y ordenan por ahorro", () => {
    const ofertas = definicionDeColeccion("ofertas", null);
    expect(ofertas.opciones).toEqual({ soloOfertas: true });
    expect(ofertas.ordenPorDefecto).toBe("ahorro");
    expect(ofertas.ordenes.map((o) => o.valor)).toContain("ahorro");
  });

  it("los nuevos ingresos piden precio y ordenan por fecha", () => {
    const nuevos = definicionDeColeccion("nuevos", null);
    expect(nuevos.opciones).toEqual({ soloConPrecio: true });
    expect(nuevos.ordenPorDefecto).toBe("nuevos");
  });

  it("una marca se titula con su nombre", () => {
    expect(definicionDeColeccion("marca", { nombre: "Logitech" }).titulo).toBe("Logitech");
  });
});
