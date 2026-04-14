import { describe, expect, it } from "vitest";
import { buildPcCatalogEntries, evaluatePcCompatibility, inferPcComponentType } from "@/lib/pcBuilder";
import type { Product } from "@/models/products";

function product(overrides: Partial<Product>): Product {
  return {
    id: 1,
    name: "Producto",
    description: "",
    image: "",
    category: "General",
    stock: 10,
    active: true,
    ...overrides,
  };
}

describe("inferPcComponentType", () => {
  it("classifies gabinete kit as case", () => {
    const p = product({
      name: "Gabinete Perf Kitx3 6810 Tec+Mou+Fuente De Alimentación 600W",
      category: "Kit",
    });

    expect(inferPcComponentType(p)).toBe("case");
  });

  it("classifies fan kit for gabinete as cooler", () => {
    const p = product({
      name: "Fan Gamemax P/ Gabinete Kit 3 X 120Mm ARGB Rb300",
      category: "Coolers / Fans",
    });

    expect(inferPcComponentType(p)).toBe("cooler");
  });

  it("classifies fuente with gabinete context as psu", () => {
    const p = product({
      name: "Fuente 600W Cx Atx600 P/Gabinete Slim OEM",
      category: "Genericas",
    });

    expect(inferPcComponentType(p)).toBe("psu");
  });

  it("keeps CPU 'sin cooler' as cpu", () => {
    const p = product({
      name: "Procesador AMD Ryzen 5 7600X AM5 105W 38MB Sin Cooler",
      category: "AMD",
    });

    expect(inferPcComponentType(p)).toBe("cpu");
  });

  it("does not classify camera baby monitor as monitor component", () => {
    const p = product({
      name: "Camara Ip Nexxt Baby Monitor Nhc-B100",
      category: "Cámaras IP",
    });

    expect(inferPcComponentType(p)).toBeNull();
  });
});

describe("buildPcCatalogEntries", () => {
  it("excludes DDR3 ram entries from eligible catalog", () => {
    const ddr3 = product({
      id: 101,
      name: "DDR3 8GB Hiksemi 1600MHz",
      category: "DDR4",
      specs: { memory_type: "DDR3" },
    });
    const ddr4 = product({
      id: 102,
      name: "DDR4 16GB Hiksemi 3200MHz",
      category: "DDR4",
      specs: { memory_type: "DDR4" },
    });

    const entries = buildPcCatalogEntries([ddr3, ddr4], { includeInactive: false, includeUnknownType: false });
    const ddr3Entry = entries.find((entry) => entry.product.id === 101);
    const ddr4Entry = entries.find((entry) => entry.product.id === 102);

    expect(ddr3Entry?.componentType).toBe("ram");
    expect(ddr3Entry?.eligible).toBe(false);
    expect(ddr4Entry?.componentType).toBe("ram");
    expect(ddr4Entry?.eligible).toBe(true);
  });
});

describe("evaluatePcCompatibility", () => {
  it("warns when CPU generation may require BIOS update", () => {
    const entries = buildPcCatalogEntries([
      product({
        id: 201,
        name: "Procesador AMD Ryzen 7 9700X AM5",
        category: "AMD",
        specs: { socket: "AM5", platform_brand: "amd", cpu_generation: 9, tdp_w: 120 },
      }),
      product({
        id: 202,
        name: "Motherboard AM5 B650 DDR5 ATX",
        category: "Motherboards",
        specs: {
          socket: "AM5",
          platform_brand: "amd",
          memory_type: "DDR5",
          form_factor: "ATX",
          mb_cpu_gen_max: 9,
          mb_bios_cpu_gen_ready: 7,
        },
      }),
    ]);

    const cpu = entries.find((entry) => entry.product.id === 201)!;
    const motherboard = entries.find((entry) => entry.product.id === 202)!;
    const result = evaluatePcCompatibility({ cpu, motherboard });

    expect(result.compatible).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("BIOS"))).toBe(true);
  });

  it("fails when cooler thermal capacity is below CPU TDP", () => {
    const entries = buildPcCatalogEntries([
      product({
        id: 301,
        name: "Procesador AMD Ryzen 7 7700X AM5",
        category: "AMD",
        specs: { socket: "AM5", platform_brand: "amd", tdp_w: 105 },
      }),
      product({
        id: 302,
        name: "Cooler De Procesador Air AM5 90W",
        category: "Coolers / Fans",
        specs: { socket_supported: "AM5", cooler_tdp_w: 90, cooler_type: "air" },
      }),
    ]);

    const cpu = entries.find((entry) => entry.product.id === 301)!;
    const cooler = entries.find((entry) => entry.product.id === 302)!;
    const result = evaluatePcCompatibility({ cpu, cooler });

    expect(result.compatible).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("Capacidad térmica insuficiente"))).toBe(true);
  });

  it("detects M.2 slot over-allocation with lane rules", () => {
    const entries = buildPcCatalogEntries([
      product({
        id: 401,
        name: "Motherboard AM5 B650 DDR5 ATX",
        category: "Motherboards",
        specs: {
          socket: "AM5",
          platform_brand: "amd",
          memory_type: "DDR5",
          form_factor: "ATX",
          interface: "PCIe, NVMe, SATA",
          mb_m2_slots: 1,
          mb_sata_ports: 4,
          mb_sata_ports_disabled_with_m2: 1,
          mb_pcie_x16_slots: 1,
        },
      }),
      product({
        id: 402,
        name: "Disco SSD M2 NVMe 1TB",
        category: "Almacenamiento",
        specs: { interface: "NVMe" },
      }),
      product({
        id: 403,
        name: "Disco SSD M2 NVMe 2TB",
        category: "Almacenamiento",
        specs: { interface: "NVMe" },
      }),
    ]);

    const motherboard = entries.find((entry) => entry.product.id === 401)!;
    const storage = entries.find((entry) => entry.product.id === 402)!;
    const storageSecondary = entries.find((entry) => entry.product.id === 403)!;
    const result = evaluatePcCompatibility(
      { motherboard, storage, storage_secondary: storageSecondary },
      { quantities: { storage: 1, storage_secondary: 1 } },
    );

    expect(result.compatible).toBe(false);
    expect(result.reasons.some((reason) => reason.includes("M.2/NVMe"))).toBe(true);
  });
});
