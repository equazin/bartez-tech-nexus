import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAllAirProductsMock,
  fetchAllAirSypMock,
  syncSupplierCatalogRecordsMock,
} = vi.hoisted(() => ({
  fetchAllAirProductsMock: vi.fn(),
  fetchAllAirSypMock: vi.fn(),
  syncSupplierCatalogRecordsMock: vi.fn(),
}));

vi.mock("@/lib/api/airApi", () => ({
  fetchAllAirProducts: fetchAllAirProductsMock,
  fetchAllAirSyp: fetchAllAirSypMock,
}));

vi.mock("@/lib/api/supplierSync", () => ({
  syncSupplierCatalogRecords: syncSupplierCatalogRecordsMock,
}));

import { syncAirCatalog, syncAirPricesStock } from "@/lib/api/airSync";

describe("air sync flows", () => {
  beforeEach(() => {
    fetchAllAirProductsMock.mockReset();
    fetchAllAirSypMock.mockReset();
    syncSupplierCatalogRecordsMock.mockReset();

    syncSupplierCatalogRecordsMock.mockResolvedValue({
      supplierId: "air-supplier",
      inserted: 0,
      updated: 0,
      skipped: 0,
      touchedProductIds: [],
      errors: [],
    });
  });

  it("allows catalog sync to create new AIR products", async () => {
    fetchAllAirProductsMock.mockResolvedValue([
      {
        codigo: "SKU-1",
        descrip: "Producto AIR",
        precio: 10,
        ros: { disponible: 3 },
        lug: { disponible: 0 },
        estado: { id: "P" },
        impuesto_iva: { alicuota: 21 },
      },
    ]);

    await syncAirCatalog();

    expect(syncSupplierCatalogRecordsMock).toHaveBeenCalledTimes(1);
    expect(syncSupplierCatalogRecordsMock.mock.calls[0][2]).not.toHaveProperty("createMissingProducts");
  });

  it("prevents price/stock sync from creating missing products", async () => {
    fetchAllAirSypMock.mockResolvedValue([
      {
        codigo: "SKU-2",
        precio: 25,
        ros: { disponible: 5 },
        lug: { disponible: 1 },
      },
    ]);

    await syncAirPricesStock();

    expect(syncSupplierCatalogRecordsMock).toHaveBeenCalledTimes(1);
    expect(syncSupplierCatalogRecordsMock.mock.calls[0][2]).toMatchObject({
      createMissingProducts: false,
    });
  });
});
