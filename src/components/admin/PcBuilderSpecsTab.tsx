import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, PlusCircle, Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { backend, hasBackendUrl } from "@/lib/api/backend";
import {
  buildPcCatalogEntries,
  getCanonicalKeyLabel,
  getProductSpecsRecord,
  PC_CANONICAL_KEYS,
  PC_COMPONENT_LABELS,
  type PcCanonicalSpecKey,
  type PcCatalogEntry,
  type PcComponentType,
} from "@/lib/pcBuilder";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/models/products";

interface PcBuilderSpecsTabProps {
  products: Product[];
  onRefresh: () => Promise<void> | void;
  isDark?: boolean;
}

type CompletenessFilter = "all" | "complete" | "incomplete";
type AssignedEntry = PcCatalogEntry & { componentType: PcComponentType };

const NON_APPLICABLE_KEYS: Record<PcComponentType, PcCanonicalSpecKey[]> = {
  cpu: ["gpu_length_mm", "case_gpu_max_mm", "socket_supported"],
  motherboard: ["wattage", "tdp_w", "gpu_length_mm", "case_gpu_max_mm", "socket_supported"],
  ram: ["socket", "platform_brand", "wattage", "tdp_w", "gpu_length_mm", "case_gpu_max_mm", "socket_supported"],
  gpu: ["socket", "platform_brand", "memory_type", "form_factor", "wattage", "socket_supported", "case_gpu_max_mm"],
  storage: ["socket", "platform_brand", "memory_type", "form_factor", "wattage", "tdp_w", "gpu_length_mm", "case_gpu_max_mm", "socket_supported"],
  psu: ["socket", "platform_brand", "memory_type", "socket_supported", "interface", "gpu_length_mm", "case_gpu_max_mm"],
  case: ["socket", "platform_brand", "memory_type", "wattage", "tdp_w", "socket_supported", "interface", "gpu_length_mm"],
  cooler: ["memory_type", "form_factor", "wattage", "tdp_w", "gpu_length_mm", "case_gpu_max_mm", "interface"],
  monitor: ["socket", "platform_brand", "memory_type", "form_factor", "wattage", "tdp_w", "socket_supported", "gpu_length_mm", "case_gpu_max_mm"],
};

const SOCKET_MEMORY_HINTS: Record<string, string> = {
  AM1: "DDR3",
  AM2: "DDR2",
  AM3: "DDR3",
  AM4: "DDR4",
  AM5: "DDR5",
  LGA1851: "DDR5",
  LGA1700: "DDR5",
  LGA1200: "DDR4",
  LGA1151: "DDR4",
};

function getCanonicalValue(entry: PcCatalogEntry, key: PcCanonicalSpecKey): string {
  const value = entry.specs[key];
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return String(value);
  const raw = value ?? "";
  return isUnsetLikeValue(raw) ? "" : raw;
}

function getSupplierLabel(product: Product): string {
  if (product.supplier_name?.trim()) return product.supplier_name.trim();
  if (product.primary_supplier_id?.trim()) return product.primary_supplier_id.trim();
  return "Sin proveedor";
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isUnsetLikeValue(value: string): boolean {
  const normalized = normalizeText(value);
  return (
    normalized.length === 0 ||
    normalized === "sin dato" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "-"
  );
}

function getProductText(product: Product): string {
  return [
    product.name_custom?.trim(),
    product.name_original?.trim(),
    product.name,
    product.category?.trim(),
    product.brand_name?.trim(),
    product.description?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

function detectSocket(rawText: string): string | null {
  const text = normalizeText(rawText);
  const match = text.match(/\b(lga[\s-]?\d{3,4}|s[\s-]?\d{4}|am[\s-]?[1-5]|fm[\s-]?[12]|tr4|trx4)\b/);
  if (!match) return null;
  const token = match[1].toUpperCase().replace(/\s+/g, "");
  if (token.startsWith("S") && /^\d{4}$/.test(token.slice(1))) return `LGA${token.slice(1)}`;
  if (token.startsWith("AM") || token.startsWith("FM") || token === "TR4" || token === "TRX4") return token;
  if (token.startsWith("LGA")) return token;
  return null;
}

function detectSocketSupported(rawText: string): string {
  const text = normalizeText(rawText);
  const matches = Array.from(text.matchAll(/\b(lga[\s-]?\d{3,4}|s[\s-]?\d{4}|am[\s-]?[1-5]|fm[\s-]?[12]|tr4|trx4)\b/g));
  const sockets = matches
    .map((match) => {
      const token = match[1].toUpperCase().replace(/\s+/g, "");
      if (token.startsWith("S") && /^\d{4}$/.test(token.slice(1))) return `LGA${token.slice(1)}`;
      if (token.startsWith("AM") || token.startsWith("FM") || token === "TR4" || token === "TRX4") return token;
      return token.startsWith("LGA") ? token : null;
    })
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(sockets)).join(", ");
}

function detectMemoryType(rawText: string): string {
  const text = normalizeText(rawText);
  if (text.includes("ddr5")) return "DDR5";
  if (text.includes("ddr4")) return "DDR4";
  if (text.includes("ddr3")) return "DDR3";
  if (text.includes("ddr2")) return "DDR2";
  return "";
}

function detectFormFactor(rawText: string): string {
  const text = normalizeText(rawText);
  if (text.includes("so-dimm") || text.includes("sodimm")) return "SO-DIMM";
  if (text.includes("u-dimm") || text.includes("udimm")) return "UDIMM";
  if (/\bdimm\b/.test(text)) return "DIMM";
  if (text.includes("e-atx") || text.includes("eatx")) return "E-ATX";
  if (text.includes("m-atx") || text.includes("matx") || (text.includes("micro") && text.includes("atx"))) return "mATX";
  if (text.includes("mini-itx") || text.includes("itx")) return "Mini-ITX";
  if (/\batx\b/.test(text)) return "ATX";
  return "";
}

function detectInterface(rawText: string): string {
  const text = normalizeText(rawText);
  const values: string[] = [];
  if (text.includes("pcie")) values.push("PCIe");
  if (text.includes("nvme")) values.push("NVMe");
  if (text.includes("m.2") || text.includes("m2")) values.push("M.2");
  if (text.includes("sata")) values.push("SATA");
  if (text.includes("hdmi")) values.push("HDMI");
  if (text.includes("displayport") || text.includes("dport")) values.push("DisplayPort");
  if (text.includes("vga")) values.push("VGA");
  return Array.from(new Set(values)).join(", ");
}

function detectWatts(rawText: string): string {
  const text = normalizeText(rawText);
  const match = text.match(/\b(\d{2,4})\s?w\b/);
  return match?.[1] ?? "";
}

function detectMillimeters(rawText: string): string {
  const text = normalizeText(rawText);
  const match = text.match(/\b(\d{2,4})\s?mm\b/);
  return match?.[1] ?? "";
}

function inferPlatform(socket: string): string {
  if (!socket) return "";
  if (socket.startsWith("LGA")) return "intel";
  if (socket.startsWith("AM") || socket.startsWith("FM") || socket === "TR4" || socket === "TRX4") return "amd";
  return "";
}

export function PcBuilderSpecsTab({ products, onRefresh }: PcBuilderSpecsTabProps) {
  const [search, setSearch] = useState("");
  const [componentFilter, setComponentFilter] = useState<"all" | PcComponentType>("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>("all");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<PcCanonicalSpecKey, string>>(() =>
    Object.fromEntries(PC_CANONICAL_KEYS.map((key) => [key, ""])) as Record<PcCanonicalSpecKey, string>,
  );
  const [savingSingle, setSavingSingle] = useState(false);
  const [bulkField, setBulkField] = useState<PcCanonicalSpecKey>("socket");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkAutocompleting, setBulkAutocompleting] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualProductId, setManualProductId] = useState<number | null>(null);
  const [manualComponentType, setManualComponentType] = useState<PcComponentType>("cpu");
  const [manualAssigning, setManualAssigning] = useState(false);

  const allPcEntries = useMemo(
    () =>
      buildPcCatalogEntries(products, {
        includeInactive: true,
        includeUnknownType: true,
      }),
    [products],
  );
  const pcEntries = useMemo(
    () => allPcEntries.filter((entry): entry is AssignedEntry => Boolean(entry.componentType)),
    [allPcEntries],
  );

  const availableBrands = useMemo(() => {
    const values = new Set<string>();
    pcEntries.forEach((entry) => {
      const brand = entry.product.brand_name?.trim();
      if (brand) values.add(brand);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es-AR"));
  }, [pcEntries]);

  const availableSuppliers = useMemo(() => {
    const values = new Set<string>();
    pcEntries.forEach((entry) => values.add(getSupplierLabel(entry.product)));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "es-AR"));
  }, [pcEntries]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return pcEntries.filter((entry) => {
      if (componentFilter !== "all" && entry.componentType !== componentFilter) return false;
      if (brandFilter !== "all" && (entry.product.brand_name ?? "") !== brandFilter) return false;
      if (supplierFilter !== "all" && getSupplierLabel(entry.product) !== supplierFilter) return false;
      if (completenessFilter === "complete" && entry.missingCritical.length > 0) return false;
      if (completenessFilter === "incomplete" && entry.missingCritical.length === 0) return false;

      if (!normalizedSearch) return true;

      const name = entry.product.name_custom?.trim() || entry.product.name_original?.trim() || entry.product.name;
      const bag = [
        name,
        entry.product.sku ?? "",
        entry.product.brand_name ?? "",
        entry.product.category ?? "",
        getSupplierLabel(entry.product),
      ].join(" ").toLowerCase();
      return bag.includes(normalizedSearch);
    });
  }, [brandFilter, componentFilter, completenessFilter, pcEntries, search, supplierFilter]);

  const selectedEntry = useMemo(
    () => pcEntries.find((entry) => entry.product.id === selectedProductId) ?? null,
    [pcEntries, selectedProductId],
  );

  useEffect(() => {
    if (!selectedEntry && filteredEntries.length > 0) {
      setSelectedProductId(filteredEntries[0].product.id);
    }
  }, [filteredEntries, selectedEntry]);

  useEffect(() => {
    if (!selectedEntry) {
      setEditValues(
        Object.fromEntries(PC_CANONICAL_KEYS.map((key) => [key, ""])) as Record<PcCanonicalSpecKey, string>,
      );
      return;
    }

    const next = {} as Record<PcCanonicalSpecKey, string>;
    PC_CANONICAL_KEYS.forEach((key) => {
      next[key] = getCanonicalValue(selectedEntry, key);
    });
    setEditValues(next);
  }, [selectedEntry]);

  const suggestedByCanonicalKey = useMemo(() => {
    const map = {} as Partial<Record<PcCanonicalSpecKey, string>>;
    selectedEntry?.canonicalPreview.forEach((item) => {
      if (!map[item.canonicalKey] && item.normalizedValue.trim()) {
        map[item.canonicalKey] = item.normalizedValue.trim();
      }
    });
    return map;
  }, [selectedEntry]);

  const manualCandidates = useMemo(() => {
    const normalizedSearch = normalizeText(manualSearch);
    return products
      .filter((product) => product.active !== false)
      .filter((product) => {
        if (!normalizedSearch) return true;
        const bag = normalizeText(
          [
            product.name_custom?.trim() || product.name_original?.trim() || product.name,
            product.sku ?? "",
            product.category ?? "",
            product.brand_name ?? "",
          ].join(" "),
        );
        return bag.includes(normalizedSearch);
      })
      .slice(0, 40);
  }, [manualSearch, products]);

  const coverageSummary = useMemo(() => {
    const total = pcEntries.length;
    const complete = pcEntries.filter((entry) => entry.missingCritical.length === 0).length;
    const incomplete = total - complete;

    const missingByKey = {} as Record<PcCanonicalSpecKey, number>;
    PC_CANONICAL_KEYS.forEach((key) => {
      missingByKey[key] = 0;
    });
    pcEntries.forEach((entry) => {
      entry.missingCritical.forEach((key) => {
        missingByKey[key] += 1;
      });
    });

    return { total, complete, incomplete, missingByKey };
  }, [pcEntries]);

  const coverageByCategory = useMemo(() => {
    const stats = {} as Record<PcComponentType, { total: number; complete: number; percent: number }>;
    Object.keys(PC_COMPONENT_LABELS).forEach((type) => {
      const items = pcEntries.filter((e) => e.componentType === type);
      const total = items.length;
      const complete = items.filter((e) => e.missingCritical.length === 0).length;
      stats[type as PcComponentType] = {
        total,
        complete,
        percent: total > 0 ? Math.round((complete / total) * 100) : 0,
      };
    });
    return stats;
  }, [pcEntries]);

  const persistProductSpecs = async (productId: number, specs: Record<string, unknown>) => {
    if (hasBackendUrl) {
      try {
        const updated = await backend.products.update(productId, { specs });
        const backendSpecs =
          updated.specs && typeof updated.specs === "object"
            ? (updated.specs as Record<string, unknown>)
            : null;
        if (backendSpecs && JSON.stringify(backendSpecs) === JSON.stringify(specs)) {
          return;
        }
      } catch {
        // Fallback to direct Supabase update if backend is unavailable.
      }
    }

    const { error } = await supabase.from("products").update({ specs }).eq("id", productId);
    if (error) throw error;
  };

  const buildNextSpecs = (
    baseProduct: Product,
    values: Partial<Record<PcCanonicalSpecKey, string>>,
  ) => {
    const nextSpecs = { ...getProductSpecsRecord(baseProduct) };
    PC_CANONICAL_KEYS.forEach((key) => {
      const value = String(values[key] ?? "").trim();
      if (value && !isUnsetLikeValue(value)) {
        nextSpecs[key] = value;
      } else {
        delete nextSpecs[key];
      }
    });
    return nextSpecs;
  };

  const handleSaveSelected = async () => {
    if (!selectedEntry) return;
    setSavingSingle(true);
    try {
      const nextSpecs = buildNextSpecs(selectedEntry.product, editValues);
      await persistProductSpecs(selectedEntry.product.id, nextSpecs);
      toast.success("Specs canónicas actualizadas.");
      await Promise.resolve(onRefresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las specs.");
    } finally {
      setSavingSingle(false);
    }
  };

  const handleBulkApply = async () => {
    if (filteredEntries.length === 0) {
      toast.error("No hay productos filtrados para aplicar edición masiva.");
      return;
    }

    setBulkUpdating(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const entry of filteredEntries) {
        const nextSpecs = buildNextSpecs(entry.product, { [bulkField]: bulkValue });
        try {
          await persistProductSpecs(entry.product.id, nextSpecs);
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }

      if (successCount > 0) {
        toast.success(`Edición masiva aplicada en ${successCount} producto(s).`);
      }
      if (failCount > 0) {
        toast.warning(`${failCount} producto(s) no pudieron actualizarse.`);
      }
      await Promise.resolve(onRefresh());
    } finally {
      setBulkUpdating(false);
    }
  };

  const applySuggestions = () => {
    if (!selectedEntry) return;
    const sourceText = getProductText(selectedEntry.product);
    const buildInferredByKey = (
      entry: AssignedEntry,
      current: Record<PcCanonicalSpecKey, string>,
      suggestions: Partial<Record<PcCanonicalSpecKey, string>>,
    ): Record<PcCanonicalSpecKey, string> => {
      const inferredSocket = detectSocket(sourceText) || current.socket || "";
      const inferredMemory = detectMemoryType(sourceText) || current.memory_type || SOCKET_MEMORY_HINTS[inferredSocket] || "";
      const inferredPlatform = inferPlatform(inferredSocket);
      const inferredByKey: Partial<Record<PcCanonicalSpecKey, string>> = {
        socket: inferredSocket,
        platform_brand: inferredPlatform,
        memory_type: inferredMemory,
        form_factor: detectFormFactor(sourceText),
        wattage: detectWatts(sourceText),
        tdp_w: detectWatts(sourceText),
        socket_supported: detectSocketSupported(sourceText),
        interface: detectInterface(sourceText),
        gpu_length_mm: detectMillimeters(sourceText),
        case_gpu_max_mm: detectMillimeters(sourceText),
      };

      if (entry.componentType === "gpu" && !inferredByKey.interface) inferredByKey.interface = "PCIe";
      if (entry.componentType === "motherboard" && !inferredByKey.interface) inferredByKey.interface = "PCIe";
      if (entry.componentType === "motherboard" && !inferredByKey.form_factor) inferredByKey.form_factor = "ATX";
      if (entry.componentType === "storage" && !inferredByKey.interface) inferredByKey.interface = "SATA";
      if (entry.componentType === "ram" && !inferredByKey.form_factor) inferredByKey.form_factor = "DIMM";
      if (entry.componentType === "case" && !inferredByKey.form_factor) inferredByKey.form_factor = "ATX";

      const next = { ...current };
      PC_CANONICAL_KEYS.forEach((key) => {
        const currentValue = next[key].trim();
        if (currentValue && !isUnsetLikeValue(currentValue)) return;
        const suggestion = suggestions[key]?.trim() ?? "";
        const inferred = inferredByKey[key]?.trim() ?? "";
        if (suggestion && !isUnsetLikeValue(suggestion)) {
          next[key] = suggestion;
          return;
        }
        if (inferred && !isUnsetLikeValue(inferred)) {
          next[key] = inferred;
          return;
        }

        if (NON_APPLICABLE_KEYS[entry.componentType].includes(key)) {
          next[key] = "N/A";
        }
      });
      return next;
    };

    setEditValues((current) => buildInferredByKey(selectedEntry, current, suggestedByCanonicalKey));
    toast.success("Autocompletado aplicado sobre todas las specs posibles.");
  };

  const handleBulkAiAutocomplete = async () => {
    if (filteredEntries.length === 0) {
      toast.error("No hay productos filtrados para autocompletar.");
      return;
    }

    setBulkAutocompleting(true);
    let updatedCount = 0;
    let skippedCount = 0;
    let failCount = 0;

    const getEntrySuggestions = (entry: AssignedEntry): Partial<Record<PcCanonicalSpecKey, string>> => {
      const map = {} as Partial<Record<PcCanonicalSpecKey, string>>;
      entry.canonicalPreview.forEach((item) => {
        if (!map[item.canonicalKey] && item.normalizedValue.trim()) {
          map[item.canonicalKey] = item.normalizedValue.trim();
        }
      });
      return map;
    };

    const buildAutocompletedValues = (
      entry: AssignedEntry,
      current: Record<PcCanonicalSpecKey, string>,
      suggestions: Partial<Record<PcCanonicalSpecKey, string>>,
    ): Record<PcCanonicalSpecKey, string> => {
      const sourceText = getProductText(entry.product);
      const inferredSocket = detectSocket(sourceText) || current.socket || "";
      const inferredMemory = detectMemoryType(sourceText) || current.memory_type || SOCKET_MEMORY_HINTS[inferredSocket] || "";
      const inferredPlatform = inferPlatform(inferredSocket);
      const inferredByKey: Partial<Record<PcCanonicalSpecKey, string>> = {
        socket: inferredSocket,
        platform_brand: inferredPlatform,
        memory_type: inferredMemory,
        form_factor: detectFormFactor(sourceText),
        wattage: detectWatts(sourceText),
        tdp_w: detectWatts(sourceText),
        socket_supported: detectSocketSupported(sourceText),
        interface: detectInterface(sourceText),
        gpu_length_mm: detectMillimeters(sourceText),
        case_gpu_max_mm: detectMillimeters(sourceText),
      };

      if (entry.componentType === "gpu" && !inferredByKey.interface) inferredByKey.interface = "PCIe";
      if (entry.componentType === "motherboard" && !inferredByKey.interface) inferredByKey.interface = "PCIe";
      if (entry.componentType === "motherboard" && !inferredByKey.form_factor) inferredByKey.form_factor = "ATX";
      if (entry.componentType === "storage" && !inferredByKey.interface) inferredByKey.interface = "SATA";
      if (entry.componentType === "ram" && !inferredByKey.form_factor) inferredByKey.form_factor = "DIMM";
      if (entry.componentType === "case" && !inferredByKey.form_factor) inferredByKey.form_factor = "ATX";

      const next = { ...current };
      PC_CANONICAL_KEYS.forEach((key) => {
        const currentValue = next[key].trim();
        if (currentValue && !isUnsetLikeValue(currentValue)) return;
        const suggestion = suggestions[key]?.trim() ?? "";
        const inferred = inferredByKey[key]?.trim() ?? "";
        if (suggestion && !isUnsetLikeValue(suggestion)) {
          next[key] = suggestion;
          return;
        }
        if (inferred && !isUnsetLikeValue(inferred)) {
          next[key] = inferred;
          return;
        }
        if (NON_APPLICABLE_KEYS[entry.componentType].includes(key)) {
          next[key] = "N/A";
        }
      });
      return next;
    };

    try {
      for (const entry of filteredEntries) {
        const currentValues = Object.fromEntries(
          PC_CANONICAL_KEYS.map((key) => [key, getCanonicalValue(entry, key)]),
        ) as Record<PcCanonicalSpecKey, string>;
        const nextValues = buildAutocompletedValues(entry, currentValues, getEntrySuggestions(entry));

        const didChange = PC_CANONICAL_KEYS.some((key) => {
          const before = (currentValues[key] ?? "").trim();
          const after = (nextValues[key] ?? "").trim();
          return before !== after;
        });

        if (!didChange) {
          skippedCount += 1;
          continue;
        }

        try {
          const nextSpecs = buildNextSpecs(entry.product, nextValues);
          await persistProductSpecs(entry.product.id, nextSpecs);
          updatedCount += 1;
        } catch {
          failCount += 1;
        }
      }

      if (updatedCount > 0) {
        toast.success(`IA masiva aplicada en ${updatedCount} producto(s).`);
      }
      if (skippedCount > 0) {
        toast.info(`${skippedCount} producto(s) ya estaban completos o sin cambios.`);
      }
      if (failCount > 0) {
        toast.warning(`${failCount} producto(s) no pudieron actualizarse.`);
      }
      await Promise.resolve(onRefresh());
    } finally {
      setBulkAutocompleting(false);
    }
  };

  const handleManualAssign = async () => {
    if (!manualProductId) {
      toast.error("Seleccioná un producto para asignar.");
      return;
    }

    const selectedProduct = products.find((product) => product.id === manualProductId);
    if (!selectedProduct) {
      toast.error("No encontramos el producto seleccionado.");
      return;
    }

    setManualAssigning(true);
    try {
      const currentSpecs = getProductSpecsRecord(selectedProduct);
      const nextSpecs = {
        ...currentSpecs,
        pc_component_type: manualComponentType,
      };
      await persistProductSpecs(selectedProduct.id, nextSpecs);
      toast.success(`Producto asignado a ${PC_COMPONENT_LABELS[manualComponentType]}.`);
      await Promise.resolve(onRefresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar el producto.");
    } finally {
      setManualAssigning(false);
    }
  };

  if (pcEntries.length === 0) {
    return (
      <EmptyState
        className="rounded-[24px]"
        icon={<Cpu size={24} />}
        title="Sin catálogo de Armador PC"
        description="No detectamos productos con categorías de componentes PC para administrar specs."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Admin · Armador PC"
        title="Calidad técnica y specs canónicas"
        description="Normalizá specs de productos para habilitar compatibilidad estricta en el Armador PC."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <SurfaceCard padding="sm" className="rounded-[20px] border-border/70">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Catálogo PC</p>
          <p className="mt-1 text-2xl font-black text-foreground">{coverageSummary.total}</p>
        </SurfaceCard>
        <SurfaceCard padding="sm" className="rounded-[20px] border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium uppercase tracking-wider">Ready para Armado</p>
          <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{coverageSummary.complete}</p>
        </SurfaceCard>
        <SurfaceCard padding="sm" className="rounded-[20px] border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium uppercase tracking-wider">Incompletos</p>
          <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">{coverageSummary.incomplete}</p>
        </SurfaceCard>
        <SurfaceCard padding="sm" className="rounded-[20px] border-primary/30 bg-primary/5">
          <p className="text-xs text-primary font-medium uppercase tracking-wider">Health Score</p>
          <p className="mt-1 text-2xl font-black text-primary">
            {Math.round((coverageSummary.complete / coverageSummary.total) * 100)}%
          </p>
        </SurfaceCard>
      </div>

      <SurfaceCard padding="md" className="rounded-[24px] border-border/70">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Cobertura por Categoría</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7">
          {(Object.entries(coverageByCategory) as Array<[PcComponentType, any]>).map(([type, stats]) => (
            <div key={type} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className="truncate pr-1 text-muted-foreground">{PC_COMPONENT_LABELS[type]}</span>
                <span className={stats.percent === 100 ? "text-emerald-500" : stats.percent > 50 ? "text-amber-500" : "text-red-500"}>
                  {stats.percent}%
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div 
                  className={`h-full transition-all ${stats.percent === 100 ? "bg-emerald-500" : stats.percent > 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
              <p className="text-[9px] text-muted-foreground/60">{stats.complete}/{stats.total} productos</p>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
          <div className="grid gap-2 md:grid-cols-5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, SKU o marca"
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none md:col-span-2"
            />
            <select
              value={componentFilter}
              onChange={(event) => setComponentFilter(event.target.value as "all" | PcComponentType)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            >
              <option value="all">Todas las categorías</option>
              {Object.entries(PC_COMPONENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            >
              <option value="all">Todas las marcas</option>
              {availableBrands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
              className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            >
              <option value="all">Todos los proveedores</option>
              {availableSuppliers.map((supplier) => (
                <option key={supplier} value={supplier}>{supplier}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "complete", "incomplete"] as CompletenessFilter[]).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={completenessFilter === value ? "default" : "outline"}
                onClick={() => setCompletenessFilter(value)}
              >
                {value === "all" ? "Todo" : value === "complete" ? "Completos" : "Con faltantes"}
              </Button>
            ))}
            <Badge variant="muted">{filteredEntries.length} resultado(s)</Badge>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/70">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Componente</th>
                  <th className="px-3 py-2 text-left">Marca</th>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-left">Completitud</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const isSelected = selectedProductId === entry.product.id;
                  const productLabel = entry.product.name_custom?.trim() || entry.product.name_original?.trim() || entry.product.name;
                  return (
                    <tr
                      key={entry.product.id}
                      onClick={() => setSelectedProductId(entry.product.id)}
                      className={`cursor-pointer border-t border-border/60 transition ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{productLabel}</p>
                        <p className="text-xs text-muted-foreground">{entry.product.sku || "Sin SKU"}</p>
                      </td>
                      <td className="px-3 py-2">{PC_COMPONENT_LABELS[entry.componentType]}</td>
                      <td className="px-3 py-2">{entry.product.brand_name || "Sin marca"}</td>
                      <td className="px-3 py-2">{getSupplierLabel(entry.product)}</td>
                      <td className="px-3 py-2">
                        {entry.missingCritical.length === 0 ? (
                          <Badge variant="success">Completo</Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="warning">Faltan {entry.missingCritical.length}</Badge>
                            <p className="text-[11px] text-muted-foreground">
                              {entry.missingCritical.slice(0, 2).map(getCanonicalKeyLabel).join(", ")}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredEntries.length === 0 && (
            <EmptyState
              className="rounded-[20px]"
              icon={<AlertTriangle size={20} />}
              title="Sin resultados"
              description="No hay productos que coincidan con los filtros actuales."
            />
          )}
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard padding="md" className="space-y-4 rounded-[24px] border-border/70">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Edición individual
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                {selectedEntry
                  ? selectedEntry.product.name_custom?.trim() ||
                    selectedEntry.product.name_original?.trim() ||
                    selectedEntry.product.name
                  : "Seleccioná un producto"}
              </h3>
            </div>

            {!selectedEntry ? (
              <p className="text-sm text-muted-foreground">No hay producto seleccionado.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{PC_COMPONENT_LABELS[selectedEntry.componentType]}</Badge>
                  {selectedEntry.missingCritical.length === 0 ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 size={12} />
                      Specs completas
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle size={12} />
                      Faltan {selectedEntry.missingCritical.length}
                    </Badge>
                  )}
                </div>

                {PC_CANONICAL_KEYS.map((key) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-xs text-muted-foreground">{getCanonicalKeyLabel(key)}</span>
                    <input
                      value={editValues[key] ?? ""}
                      onChange={(event) => setEditValues((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder={suggestedByCanonicalKey[key] ? `Sugerido: ${suggestedByCanonicalKey[key]}` : "Sin dato"}
                      className="h-9 w-full rounded-lg border border-border/70 bg-background px-3 text-sm outline-none"
                    />
                  </label>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="soft" className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20" onClick={applySuggestions}>
                    <Sparkles size={14} className="text-primary" />
                    IA Autocompletar
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditValues(Object.fromEntries(PC_CANONICAL_KEYS.map(k => [k, ""])))}>
                    Limpiar
                  </Button>
                  <Button type="button" className="bg-gradient-primary shadow-lg shadow-primary/20" onClick={() => void handleSaveSelected()} disabled={savingSingle}>
                    <Save size={14} />
                    {savingSingle ? "Guardando..." : "Guardar specs"}
                  </Button>
                </div>

                {selectedEntry.canonicalPreview.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-surface/70 p-3">
                    <p className="text-xs font-semibold text-foreground">Preview de normalización</p>
                    <div className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                      {selectedEntry.canonicalPreview.map((item) => (
                        <p key={`${item.rawKey}-${item.canonicalKey}`}>
                          {item.rawKey} → <span className="text-foreground">{getCanonicalKeyLabel(item.canonicalKey)}</span>: {item.normalizedValue}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard padding="md" className="space-y-3 rounded-[24px] border-border/70">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Edición masiva
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Aplicar por filtro actual</h3>
            </div>

            <select
              value={bulkField}
              onChange={(event) => setBulkField(event.target.value as PcCanonicalSpecKey)}
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            >
              {PC_CANONICAL_KEYS.map((key) => (
                <option key={key} value={key}>{getCanonicalKeyLabel(key)}</option>
              ))}
            </select>
            <input
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
              placeholder="Valor a aplicar (vacío = limpiar campo)"
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            />
            <Button
              type="button"
              variant="soft"
              disabled={bulkUpdating || filteredEntries.length === 0}
              onClick={() => void handleBulkApply()}
            >
              <Wand2 size={14} />
              {bulkUpdating ? "Aplicando..." : `Aplicar a ${filteredEntries.length} producto(s)`}
            </Button>
            <Button
              type="button"
              variant="soft"
              className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
              disabled={bulkAutocompleting || filteredEntries.length === 0}
              onClick={() => void handleBulkAiAutocomplete()}
            >
              <Sparkles size={14} />
              {bulkAutocompleting ? "Autocompletando..." : `IA masiva (${filteredEntries.length})`}
            </Button>
          </SurfaceCard>

          <SurfaceCard padding="md" className="space-y-3 rounded-[24px] border-border/70">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                AsignaciÃ³n manual
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">Agregar producto a secciÃ³n del Armador</h3>
            </div>

            <input
              value={manualSearch}
              onChange={(event) => setManualSearch(event.target.value)}
              placeholder="Buscar producto por nombre o SKU"
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            />
            <select
              value={manualProductId ?? ""}
              onChange={(event) => setManualProductId(event.target.value ? Number(event.target.value) : null)}
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            >
              <option value="">Seleccionar producto</option>
              {manualCandidates.map((product) => {
                const label = product.name_custom?.trim() || product.name_original?.trim() || product.name;
                return (
                  <option key={product.id} value={product.id}>
                    {label} {product.sku ? `(${product.sku})` : ""}
                  </option>
                );
              })}
            </select>
            <select
              value={manualComponentType}
              onChange={(event) => setManualComponentType(event.target.value as PcComponentType)}
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none"
            >
              {Object.entries(PC_COMPONENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button type="button" onClick={() => void handleManualAssign()} disabled={manualAssigning}>
              <PlusCircle size={14} />
              {manualAssigning ? "Asignando..." : "Agregar a secciÃ³n"}
            </Button>
          </SurfaceCard>

          <SurfaceCard padding="md" className="rounded-[24px] border-border/70">
            <p className="text-xs font-semibold text-foreground">Faltantes más comunes</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {PC_CANONICAL_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span>{getCanonicalKeyLabel(key)}</span>
                  <Badge variant="outline">{coverageSummary.missingByKey[key]}</Badge>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
