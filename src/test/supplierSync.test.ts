import { describe, expect, it } from "vitest";
import {
  choosePreferredSupplier,
  findMatchingCatalogProduct,
  type SupplierCatalogRecord,
} from "@/lib/api/supplierSync";

describe("supplier sync", () => {
  it("matches an incoming product by manufacturer part number before name", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "Proveedor B",
      supplierExternalId: "B-1000",
      supplierSku: "B-1000",
      canonicalSku: "LAT-5540",
      manufacturerPartNumber: "LAT-5540",
      name: "Notebook Dell Latitude 5540",
      costPrice: 950000,
      stockAvailable: 8,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 10,
          sku: "AIR-9999",
          name: "Notebook Dell Latitude 5540",
          name_original: "Notebook Dell Latitude 5540",
          cost_price: 990000,
          stock: 5,
          specs: { manufacturer_part_number: "LAT-5540" },
        },
        {
          id: 11,
          sku: "NOTE-ALTERNATIVA",
          name: "Otra notebook",
          cost_price: 910000,
          stock: 2,
        },
      ],
      record
    );

    expect(match?.id).toBe(10);
  });

  it("falls back to exact normalized name when there is no sku hint", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "Proveedor C",
      supplierExternalId: "C-200",
      name: "Camara Hikvision ColorVu 4MP",
      costPrice: 150000,
      stockAvailable: 12,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 22,
          sku: null,
          name: "Camara Hikvision ColorVu 4MP",
          name_original: "Camara Hikvision ColorVu 4MP",
          cost_price: 180000,
          stock: 4,
        },
      ],
      record
    );

    expect(match?.id).toBe(22);
  });

  it("matches by EAN when sku/part number differ between suppliers", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "ELIT",
      supplierExternalId: "991122",
      supplierSku: "EL-ABC-99",
      manufacturerPartNumber: null,
      ean: "7791234567890",
      name: "Monitor 24 pulgadas",
      costPrice: 250,
      stockAvailable: 3,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 30,
          sku: "AIR-XYZ-01",
          name: "Monitor Samsung 24",
          name_original: "Monitor Samsung 24",
          cost_price: 280,
          stock: 2,
          specs: { ean: "7791234567890" },
        },
      ],
      record
    );

    expect(match?.id).toBe(30);
  });

  it("matches by fuzzy name + brand when exact name is not identical", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "ELIT",
      supplierExternalId: "A-77",
      supplierSku: "SKU-77",
      name: "Notebook Dell Inspiron 15 3520 i5 8gb 512gb",
      brand: "Dell",
      costPrice: 780,
      stockAvailable: 5,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 42,
          sku: "NB-DL-3520",
          name: "Notebook Dell Inspiron 15 3520 Core i5 8GB SSD 512GB",
          name_original: "Notebook Dell Inspiron 15 3520 Core i5 8GB SSD 512GB",
          cost_price: 810,
          stock: 4,
          specs: { supplier_brand: "Dell" },
        },
      ],
      record
    );

    expect(match?.id).toBe(42);
  });

  it("matches AIR internal sku against ELIT part-number model token", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "ELIT",
      supplierExternalId: "EL-INTEL-285K",
      supplierSku: "BX80768285K",
      canonicalSku: "BX80768285K",
      manufacturerPartNumber: "BX80768285K",
      brand: "Intel",
      name: "Procesador Intel Core Ultra 7 BX80768285K",
      costPrice: 410,
      stockAvailable: 6,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 55,
          sku: "215125",
          name: "Procesador Intel Core Ultra 7 285K",
          name_original: "Procesador Intel Core Ultra 7 285K",
          cost_price: 430,
          stock: 3,
          specs: { supplier_brand: "Intel" },
        },
        {
          id: 56,
          sku: "778899",
          name: "Procesador AMD Ryzen 7 7800X3D",
          name_original: "Procesador AMD Ryzen 7 7800X3D",
          cost_price: 500,
          stock: 2,
          specs: { supplier_brand: "AMD" },
        },
      ],
      record
    );

    expect(match?.id).toBe(55);
  });

  it("does not match storage products with different capacity tiers", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "ELIT",
      supplierExternalId: "SSD-4TB-001",
      supplierSku: "SFYR2S/4T0",
      canonicalSku: "SFYR2S/4T0",
      manufacturerPartNumber: "SFYR2S/4T0",
      brand: "Kingston",
      name: "Disco Interno SSD KINGSTON Fury Renegade 4TB M.2 G5 Nvme",
      category: "Discos SSD",
      costPrice: 1099,
      stockAvailable: 4,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 70,
          sku: "SFYR2S/1T0",
          name: "Disco Interno SSD KINGSTON Fury Renegade 1TB M.2 G5 Nvme",
          name_original: "Disco Interno SSD KINGSTON Fury Renegade 1TB M.2 G5 Nvme",
          category: "Discos SSD",
          cost_price: 439,
          stock: 9,
          specs: { supplier_brand: "Kingston" },
        },
      ],
      record
    );

    expect(match).toBeNull();
  });

  it("does not match storage products when supplier has capacity but system product does not", () => {
    const record: SupplierCatalogRecord = {
      supplierName: "ELIT",
      supplierExternalId: "SSD-2TB-001",
      supplierSku: "SFYR2S/2T0",
      canonicalSku: "SFYR2S/2T0",
      manufacturerPartNumber: "SFYR2S/2T0",
      brand: "Kingston",
      name: "Disco Interno SSD KINGSTON Fury Renegade 2TB M.2 G5 Nvme",
      category: "Discos SSD",
      costPrice: 464,
      stockAvailable: 8,
      active: true,
    };

    const match = findMatchingCatalogProduct(
      [
        {
          id: 71,
          sku: "REN-G5",
          name: "Disco Interno SSD KINGSTON Fury Renegade M.2 G5 Nvme",
          name_original: "Disco Interno SSD KINGSTON Fury Renegade M.2 G5 Nvme",
          category: "Discos SSD",
          cost_price: 439,
          stock: 9,
          specs: { supplier_brand: "Kingston" },
        },
      ],
      record
    );

    expect(match).toBeNull();
  });

  it("chooses the cheapest active supplier with stock as preferred", () => {
    const preferred = choosePreferredSupplier([
      {
        id: "a",
        product_id: 1,
        supplier_id: "sup-a",
        cost_price: 1000,
        stock_available: 0,
        stock_reserved: 0,
        price_multiplier: 1,
        lead_time_days: 1,
        is_preferred: true,
        active: true,
        external_id: "A-1",
      },
      {
        id: "b",
        product_id: 1,
        supplier_id: "sup-b",
        cost_price: 930,
        stock_available: 5,
        stock_reserved: 0,
        price_multiplier: 1,
        lead_time_days: 3,
        is_preferred: false,
        active: true,
        external_id: "B-1",
      },
      {
        id: "c",
        product_id: 1,
        supplier_id: "sup-c",
        cost_price: 970,
        stock_available: 9,
        stock_reserved: 0,
        price_multiplier: 1,
        lead_time_days: 2,
        is_preferred: false,
        active: true,
        external_id: "C-1",
      },
    ]);

    expect(preferred?.supplier_id).toBe("sup-b");
  });
});
