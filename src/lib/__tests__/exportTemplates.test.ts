import { describe, expect, it } from "vitest";
import {
  applyFilters,
  projectRows,
  resolveFilename,
  type ExportTemplate,
} from "@/lib/exportTemplates";
import type { PriceListRow } from "@/components/portal/catalog/types";

const rows: PriceListRow[] = [
  {
    product_id: 1,
    sku: "SKU-1",
    name: "Cable UTP Cat6",
    brand_name: "Furukawa",
    category: "Redes",
    unit_price: 12000,
    stock: 50,
    min_order_qty: 1,
  },
  {
    product_id: 2,
    sku: "SKU-2",
    name: "Switch 8 puertos",
    brand_name: "TP-Link",
    category: "Redes",
    unit_price: 0,
    stock: 0,
    min_order_qty: 1,
  },
  {
    product_id: 3,
    sku: "SKU-3",
    name: "Patchcord",
    brand_name: "Furukawa",
    category: "Redes",
    unit_price: 1500,
    stock: 10,
    min_order_qty: 5,
  },
];

const defaultTemplate: ExportTemplate = {
  id: "t-default",
  slug: "default",
  name: "Lista completa",
  description: null,
  format: "csv",
  columns: [
    { key: "sku", label: "SKU" },
    { key: "name", label: "Nombre" },
    { key: "unit_price", label: "Precio" },
  ],
  filters: {},
  filename_pattern: "lista_precios_{date}",
};

describe("applyFilters", () => {
  it("returns all rows when no filters provided", () => {
    expect(applyFilters(rows, {})).toHaveLength(3);
  });

  it("drops rows with stock = 0 when drop_zero_stock is true", () => {
    const result = applyFilters(rows, { drop_zero_stock: true });
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.sku === "SKU-2")).toBeUndefined();
  });

  it("drops rows with price = 0 when drop_zero_price is true", () => {
    const result = applyFilters(rows, { drop_zero_price: true });
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.sku === "SKU-2")).toBeUndefined();
  });

  it("combines both filters", () => {
    const result = applyFilters(rows, { drop_zero_stock: true, drop_zero_price: true });
    expect(result).toHaveLength(2);
  });
});

describe("projectRows", () => {
  it("returns only selected columns with custom labels", () => {
    const projected = projectRows(rows, defaultTemplate.columns);
    expect(projected[0]).toEqual({
      SKU: "SKU-1",
      Nombre: "Cable UTP Cat6",
      Precio: 12000,
    });
    expect(Object.keys(projected[0])).toEqual(["SKU", "Nombre", "Precio"]);
  });

  it("preserves column order from template", () => {
    const reordered: ExportTemplate["columns"] = [
      { key: "unit_price", label: "$" },
      { key: "sku", label: "Code" },
    ];
    const projected = projectRows(rows, reordered);
    expect(Object.keys(projected[0])).toEqual(["$", "Code"]);
  });
});

describe("resolveFilename", () => {
  it("includes today's date and csv extension by default", () => {
    const filename = resolveFilename(defaultTemplate);
    expect(filename).toMatch(/^lista_precios_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("uses xlsx extension for xlsx format", () => {
    const xlsx: ExportTemplate = { ...defaultTemplate, format: "xlsx" };
    expect(resolveFilename(xlsx)).toMatch(/\.xlsx$/);
  });

  it("substitutes {client_name} placeholder", () => {
    const tpl: ExportTemplate = {
      ...defaultTemplate,
      filename_pattern: "precios_{client_name}_{date}",
    };
    const filename = resolveFilename(tpl, { clientName: "Distribuidora Sur" });
    expect(filename).toMatch(/^precios_distribuidora_sur_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("falls back to 'cliente' slug when client name is empty", () => {
    const tpl: ExportTemplate = {
      ...defaultTemplate,
      filename_pattern: "precios_{client_name}",
    };
    expect(resolveFilename(tpl)).toBe("precios_cliente.csv");
  });

  it("strips accents and special chars from client name", () => {
    const tpl: ExportTemplate = {
      ...defaultTemplate,
      filename_pattern: "precios_{client_name}",
    };
    expect(resolveFilename(tpl, { clientName: "José & Cía. S.A." })).toBe(
      "precios_jose_cia_s_a.csv",
    );
  });
});
