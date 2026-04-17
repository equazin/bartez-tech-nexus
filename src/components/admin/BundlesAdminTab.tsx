/**
 * BundlesAdminTab — Constructor visual de Bundles / PC Armadas / Esquemas.
 * Layout de 3 columnas: Config | Componentes | Resumen en vivo.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus, Pencil, Trash2, Layers, ArrowLeft, Check, X, Package, Loader2,
  Power, Cpu, Sliders, Tag, Search, Image as ImageIcon,
  ShoppingBag, Sparkles, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button }    from "@/components/ui/button";
import { Input }     from "@/components/ui/input";
import { Label }     from "@/components/ui/label";
import { Textarea }  from "@/components/ui/textarea";
import { Badge }     from "@/components/ui/badge";
import { Switch }    from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabase";
import { storageUrl, BUNDLES_BUCKET } from "@/lib/constants";
import type { Product } from "@/models/products";
import type { Bundle, BundleType, DiscountType } from "@/models/bundle";
import { BUNDLE_TYPE_LABELS, DISCOUNT_TYPE_LABELS } from "@/models/bundle";
import {
  fetchAllBundles, fetchBundleSlots, fetchSlotOptions,
  createBundle, updateBundle, deleteBundle,
  createSlot, updateSlot, deleteSlot,
  createSlotOption, updateSlotOption, deleteSlotOption,
} from "@/lib/api/bundleApi";

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "list" | "builder";

interface AlternativeOption {
  localId: string;
  optionId?: string;
  product: Product;
  quantity: number;
}

interface ComponentItem {
  localId: string;
  slotId?: string;
  optionId?: string;
  product: Product;
  label: string;
  quantity: number;
  is_optional: boolean;
  is_replaceable: boolean;
  client_configurable: boolean;
  sort_order: number;
  alternatives: AlternativeOption[];
  expanded: boolean;
}

interface BuilderConfig {
  title: string;
  slug: string;
  description: string;
  type: BundleType;
  image_url: string;
  discount_type: DiscountType;
  discount_pct: number;
  fixed_price: string;
  allows_customization: boolean;
  active: boolean;
}

interface Props {
  products: Product[];
  isDark?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<BundleType, typeof Cpu> = {
  pc_armada: Cpu,
  esquema:   Sliders,
  bundle:    Package,
};

const TYPE_COLORS: Record<BundleType, string> = {
  pc_armada: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  esquema:   "bg-violet-500/10 text-violet-500 border-violet-500/30",
  bundle:    "bg-primary/10 text-primary border-primary/30",
};

const EMPTY_CONFIG: BuilderConfig = {
  title: "", slug: "", description: "", type: "bundle", image_url: "",
  discount_type: "percentage", discount_pct: 0, fixed_price: "",
  allows_customization: true, active: true,
};

function genLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * En el admin los productos vienen de la tabla `products` (sin la view portal_products),
 * por lo que `unit_price` suele ser undefined. Usamos cost_price como fallback.
 */
function adminPrice(product: Product): number {
  return product.unit_price ?? product.cost_price ?? 0;
}

function titleToSlug(title: string): string {
  return title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-");
}

// ── Description generator (local — no API cost) ──────────────────────────────

type BundleDescComponent = { label: string; product_name: string; quantity: number };

/** Extrae specs clave del nombre del producto usando patrones comunes. */
function extractSpec(name: string): string {
  const n = name.toUpperCase();

  // Procesador
  const cpu = n.match(/\b(CORE\s+I[3579][-\s]\d{4,5}\w*|RYZEN\s+[357]\s+\d{4}\w*|CELERON\s+\w+|PENTIUM\s+\w+|ATHLON\s+\w+|XEON\s+\w+)\b/);
  if (cpu) return cpu[0].replace(/\s+/g, " ").trim();

  // RAM
  const ram = n.match(/\b(\d+\s*GB\s+(?:DDR[345]|RAM|SODIMM|DIMM)|\b(?:DDR[345])\s+\d+\s*GB)\b/);
  if (ram) return ram[0].trim();

  // Almacenamiento
  const storage = n.match(/\b(\d+\s*(?:GB|TB)\s+(?:SSD|HDD|NVME|M\.2|SATA)|(?:SSD|HDD|NVME)\s+\d+\s*(?:GB|TB))\b/);
  if (storage) return storage[0].trim();

  // GPU
  const gpu = n.match(/\b(RTX\s*\d{4}\w*|GTX\s*\d{4}\w*|RX\s*\d{4}\w*|RADEON\s+\w+|GEFORCE\s+\w+)\b/);
  if (gpu) return gpu[0].trim();

  // Monitor
  const monitor = n.match(/\b(\d{2}"\s*(?:FHD|QHD|4K|IPS|VA|LED)?|\d{2}\s*PULGADAS?)\b/);
  if (monitor) return monitor[0].trim();

  // Fallback: primeras 4 palabras del nombre
  return name.split(/\s+/).slice(0, 4).join(" ");
}

const TYPE_DESC: Record<string, string> = {
  pc_armada: "PC armada y testeada, lista para usar desde el primer día",
  esquema:   "esquema configurable de PC, adaptable a las necesidades de cada puesto de trabajo",
  bundle:    "combo de productos tecnológicos seleccionados para trabajo profesional",
};

function generateBundleDescription(
  bundleType: string,
  bundleTitle: string,
  comps: BundleDescComponent[],
): string {
  const specs = comps.map(c => {
    const spec  = extractSpec(c.product_name);
    const label = c.label && c.label !== c.product_name ? `${c.label}: ` : "";
    const qty   = c.quantity > 1 ? ` (x${c.quantity})` : "";
    return `${label}${spec}${qty}`;
  });

  const typeDesc = TYPE_DESC[bundleType] ?? "bundle de tecnología";

  // Oraciones de descripción
  const intro = `${bundleTitle} es una ${typeDesc} orientada a empresas, integradores y revendedores.`;

  const specLine = specs.length > 0
    ? `Incluye ${specs.slice(0, 5).join(", ")}${specs.length > 5 ? ` y ${specs.length - 5} componente(s) más` : ""}.`
    : "";

  const closing = bundleType === "esquema"
    ? "Ideal para equipar múltiples puestos con flexibilidad de configuración según el perfil del usuario."
    : "Solución completa para optimizar la productividad y escalar el equipamiento IT de forma eficiente.";

  return [intro, specLine, closing].filter(Boolean).join(" ");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BundlesAdminTab({ products }: Props) {
  // ── Global state ──────────────────────────────────────────────────────────
  const [view, setView]         = useState<View>("list");
  const [bundles, setBundles]   = useState<Bundle[]>([]);
  const [loading, setLoading]   = useState(true);

  // ── Builder state ─────────────────────────────────────────────────────────
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [config, setConfig]               = useState<BuilderConfig>(EMPTY_CONFIG);
  const [components, setComponents]       = useState<ComponentItem[]>([]);
  const [saving, setSaving]               = useState(false);
  const [imageFile, setImageFile]         = useState<File | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Product search (main)
  const [productSearch, setProductSearch]         = useState("");
  const [showSearch, setShowSearch]               = useState(false);
  const [addingComponentId, setAddingComponentId] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Product search (per-component alternatives)
  const [altSearch, setAltSearch]           = useState<Record<string, string>>({});
  const [showAltSearch, setShowAltSearch]   = useState<Record<string, boolean>>({});
  const [addingAltId, setAddingAltId]       = useState<string | null>(null);
  const altSearchRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadBundles = useCallback(async () => {
    setLoading(true);
    try { setBundles(await fetchAllBundles()); }
    catch { toast.error("No se pudo cargar los bundles."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadBundles(); }, [loadBundles]);

  // ── AI description generation ─────────────────────────────────────────────

  const handleGenerateDescription = useCallback(() => {
    if (components.length === 0) {
      toast.warning("Agregá al menos un componente antes de generar la descripción.");
      return;
    }
    const comps = components.map(c => ({
      label:        c.label || c.product.name,
      product_name: c.product.name,
      quantity:     c.quantity,
    }));
    const description = generateBundleDescription(config.type, config.title || "Bundle", comps);
    setConfig(p => ({ ...p, description }));
    toast.success("Descripción generada.");
  }, [components, config.type, config.title]);

  // Close main search dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── Builder open ──────────────────────────────────────────────────────────

  function openNewBuilder() {
    setEditingBundle(null);
    setConfig(EMPTY_CONFIG);
    setComponents([]);
    setProductSearch("");
    setAltSearch({});
    setShowAltSearch({});
    setImageFile(null);
    setView("builder");
  }

  async function openEditBuilder(bundle: Bundle) {
    setEditingBundle(bundle);
    setConfig({
      title:               bundle.title,
      slug:                bundle.slug ?? "",
      description:         bundle.description ?? "",
      type:                bundle.type,
      image_url:           bundle.image_url ?? "",
      discount_type:       bundle.discount_type,
      discount_pct:        bundle.discount_pct,
      fixed_price:         bundle.fixed_price != null ? String(bundle.fixed_price) : "",
      allows_customization: bundle.allows_customization,
      active:              bundle.active,
    });
    setComponents([]);
    setProductSearch("");
    setAltSearch({});
    setShowAltSearch({});
    setImageFile(null);
    setView("builder");

    try {
      const slots = await fetchBundleSlots(bundle.id);
      const items: ComponentItem[] = [];
      for (const slot of slots) {
        const opts = await fetchSlotOptions(slot.id);
        const def  = opts.find((o) => o.is_default) ?? opts[0];
        if (!def) continue;
        const product = products.find((p) => p.id === def.product_id);
        if (!product) continue;
        const alternatives: AlternativeOption[] = opts
          .filter((o) => o.id !== def.id)
          .map((o) => {
            const p = products.find((pr) => pr.id === o.product_id);
            return p ? { localId: o.id, optionId: o.id, product: p, quantity: o.quantity } : null;
          })
          .filter((x): x is AlternativeOption => x !== null);

        items.push({
          localId:            slot.id,
          slotId:             slot.id,
          optionId:           def.id,
          product,
          label:              slot.label,
          quantity:           def.quantity,
          is_optional:        def.is_optional,
          is_replaceable:     def.is_replaceable,
          client_configurable: slot.client_configurable,
          sort_order:         slot.sort_order,
          alternatives,
          expanded:           false,
        });
      }
      setComponents(items.sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      toast.error("No se pudieron cargar los componentes.");
    }
  }

  // ── Component CRUD ────────────────────────────────────────────────────────

  async function handleAddProduct(product: Product) {
    if (components.some((c) => c.product.id === product.id)) {
      toast.error("Este producto ya está en el bundle.");
      return;
    }
    setAddingComponentId(product.id);
    try {
      const sortOrder = components.length;
      const label     = product.name.split(" ").slice(0, 4).join(" ");

      if (editingBundle) {
        const slot = await createSlot({
          bundle_id:          editingBundle.id,
          label,
          category_id:        null,
          required:           true,
          client_configurable: false,
          sort_order:         sortOrder,
        });
        const opt = await createSlotOption({
          slot_id:        slot.id,
          product_id:     product.id,
          is_default:     true,
          sort_order:     0,
          quantity:       1,
          is_optional:    false,
          is_replaceable: false,
        });
        setComponents((prev) => [...prev, {
          localId: slot.id, slotId: slot.id, optionId: opt.id,
          product, label, quantity: 1, is_optional: false, is_replaceable: false,
          client_configurable: false, sort_order: sortOrder,
          alternatives: [], expanded: false,
        }]);
      } else {
        setComponents((prev) => [...prev, {
          localId: genLocalId(),
          product, label, quantity: 1, is_optional: false, is_replaceable: false,
          client_configurable: false, sort_order: sortOrder,
          alternatives: [], expanded: false,
        }]);
      }

      setProductSearch("");
      setShowSearch(false);
      toast.success(`${product.name.slice(0, 30)} agregado.`);
    } catch {
      toast.error("No se pudo agregar el componente.");
    } finally {
      setAddingComponentId(null);
    }
  }

  async function handleRemoveComponent(localId: string) {
    const comp = components.find((c) => c.localId === localId);
    if (!comp) return;
    try {
      if (comp.slotId) await deleteSlot(comp.slotId);
      setComponents((prev) => prev.filter((c) => c.localId !== localId));
    } catch {
      toast.error("No se pudo eliminar el componente.");
    }
  }

  async function patchComponent(
    localId: string,
    patch: Partial<Pick<ComponentItem,
      "quantity" | "is_optional" | "is_replaceable" |
      "client_configurable" | "label" | "expanded">>
  ) {
    setComponents((prev) =>
      prev.map((c) => c.localId === localId ? { ...c, ...patch } : c)
    );
    const comp = components.find((c) => c.localId === localId);
    if (!comp) return;
    try {
      if (comp.optionId) {
        const optPatch: { quantity?: number; is_optional?: boolean; is_replaceable?: boolean } = {};
        if (patch.quantity       !== undefined) optPatch.quantity       = patch.quantity;
        if (patch.is_optional    !== undefined) optPatch.is_optional    = patch.is_optional;
        if (patch.is_replaceable !== undefined) optPatch.is_replaceable = patch.is_replaceable;
        if (Object.keys(optPatch).length > 0) await updateSlotOption(comp.optionId, optPatch);
      }
      if (comp.slotId) {
        const slotPatch: { label?: string; client_configurable?: boolean } = {};
        if (patch.label               !== undefined) slotPatch.label               = patch.label;
        if (patch.client_configurable !== undefined) slotPatch.client_configurable = patch.client_configurable;
        if (Object.keys(slotPatch).length > 0) await updateSlot(comp.slotId, slotPatch);
      }
    } catch {
      toast.error("No se pudo actualizar el componente.");
    }
  }

  // ── Sort order ────────────────────────────────────────────────────────────

  function moveComponent(localId: string, direction: "up" | "down") {
    setComponents((prev) => {
      const idx = prev.findIndex((c) => c.localId === localId);
      if (idx < 0) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next.map((c, i) => ({ ...c, sort_order: i }));
    });
    // Persist order for edit mode (fire-and-forget per item)
    const comp = components.find((c) => c.localId === localId);
    const idx  = components.findIndex((c) => c.localId === localId);
    const neighbor = direction === "up" ? components[idx - 1] : components[idx + 1];
    if (comp?.slotId && neighbor?.slotId) {
      Promise.all([
        updateSlot(comp.slotId, { sort_order: neighbor.sort_order }),
        updateSlot(neighbor.slotId, { sort_order: comp.sort_order }),
      ]).catch(() => toast.error("No se pudo reordenar."));
    }
  }

  // ── Alternatives ──────────────────────────────────────────────────────────

  async function handleAddAlternative(localId: string, product: Product) {
    const comp = components.find((c) => c.localId === localId);
    if (!comp) return;
    if (comp.product.id === product.id || comp.alternatives.some((a) => a.product.id === product.id)) {
      toast.error("Este producto ya está en el slot.");
      return;
    }
    setAddingAltId(localId);
    try {
      const newAlt: AlternativeOption = { localId: genLocalId(), product, quantity: 1 };
      if (comp.slotId) {
        const opt = await createSlotOption({
          slot_id:        comp.slotId,
          product_id:     product.id,
          is_default:     false,
          sort_order:     comp.alternatives.length + 1,
          quantity:       1,
          is_optional:    false,
          is_replaceable: true,
        });
        newAlt.localId   = opt.id;
        newAlt.optionId  = opt.id;
      }
      setComponents((prev) =>
        prev.map((c) =>
          c.localId === localId
            ? { ...c, alternatives: [...c.alternatives, newAlt] }
            : c
        )
      );
      setAltSearch((prev) => ({ ...prev, [localId]: "" }));
      setShowAltSearch((prev) => ({ ...prev, [localId]: false }));
      toast.success("Alternativa agregada.");
    } catch {
      toast.error("No se pudo agregar la alternativa.");
    } finally {
      setAddingAltId(null);
    }
  }

  async function handleRemoveAlternative(localId: string, altLocalId: string) {
    const comp = components.find((c) => c.localId === localId);
    const alt  = comp?.alternatives.find((a) => a.localId === altLocalId);
    if (!alt) return;
    try {
      if (alt.optionId) await deleteSlotOption(alt.optionId);
      setComponents((prev) =>
        prev.map((c) =>
          c.localId === localId
            ? { ...c, alternatives: c.alternatives.filter((a) => a.localId !== altLocalId) }
            : c
        )
      );
    } catch {
      toast.error("No se pudo eliminar la alternativa.");
    }
  }

  // ── Save bundle ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!config.title.trim()) { toast.error("El título es obligatorio."); return; }
    setSaving(true);
    try {
      // Upload image if a file was selected
      let finalImageUrl = config.image_url.trim() || null;
      if (imageFile) {
        setImageUploading(true);
        const ext  = imageFile.name.split(".").pop() ?? "jpg";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUNDLES_BUCKET)
          .upload(path, imageFile, { upsert: true });
        setImageUploading(false);
        if (upErr) throw new Error(`Error subiendo imagen: ${upErr.message}`);
        finalImageUrl = storageUrl(BUNDLES_BUCKET, path);
        setConfig(p => ({ ...p, image_url: finalImageUrl ?? "" }));
        setImageFile(null);
      }

      const payload = {
        title:               config.title.trim(),
        slug:                config.slug.trim() || titleToSlug(config.title),
        description:         config.description.trim() || null,
        type:                config.type,
        image_url:           finalImageUrl,
        discount_type:       config.discount_type,
        discount_pct:        config.discount_type === "percentage" ? Number(config.discount_pct) : 0,
        fixed_price:         config.discount_type === "fixed" && config.fixed_price
                               ? Number(config.fixed_price) : null,
        allows_customization: config.allows_customization,
        active:              config.active,
      };

      if (editingBundle) {
        await updateBundle(editingBundle.id, payload);
        toast.success("Bundle actualizado.");
      } else {
        const newBundle = await createBundle(payload);
        for (let i = 0; i < components.length; i++) {
          const comp = components[i];
          const slot = await createSlot({
            bundle_id:           newBundle.id,
            label:               comp.label,
            category_id:         null,
            required:            !comp.is_optional,
            client_configurable: comp.client_configurable,
            sort_order:          i,
          });
          await createSlotOption({
            slot_id:        slot.id,
            product_id:     comp.product.id,
            is_default:     true,
            sort_order:     0,
            quantity:       comp.quantity,
            is_optional:    comp.is_optional,
            is_replaceable: comp.is_replaceable,
          });
          for (let j = 0; j < comp.alternatives.length; j++) {
            const alt = comp.alternatives[j];
            await createSlotOption({
              slot_id:        slot.id,
              product_id:     alt.product.id,
              is_default:     false,
              sort_order:     j + 1,
              quantity:       alt.quantity,
              is_optional:    false,
              is_replaceable: true,
            });
          }
        }
        toast.success("Bundle creado.");
      }

      await loadBundles();
      setView("list");
    } catch {
      toast.error("No se pudo guardar el bundle.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(bundle: Bundle) {
    try {
      await updateBundle(bundle.id, { active: !bundle.active });
      await loadBundles();
    } catch { toast.error("No se pudo cambiar el estado."); }
  }

  async function handleDeleteBundle(bundle: Bundle) {
    if (!confirm(`¿Eliminar "${bundle.title}"?`)) return;
    try {
      await deleteBundle(bundle.id);
      toast.success("Bundle eliminado.");
      await loadBundles();
    } catch { toast.error("No se pudo eliminar el bundle."); }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [products, productSearch]);

  function altSearchResults(localId: string) {
    const q = (altSearch[localId] ?? "").toLowerCase();
    if (!q.trim()) return [];
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    ).slice(0, 6);
  }

  const summary = useMemo(() => {
    const subtotal = components.reduce(
      (sum, c) => sum + adminPrice(c.product) * c.quantity, 0
    );
    let total = subtotal;
    if (config.discount_type === "percentage" && config.discount_pct > 0)
      total = subtotal * (1 - config.discount_pct / 100);
    else if (config.discount_type === "fixed" && config.fixed_price)
      total = Number(config.fixed_price);
    const saving        = Math.max(0, subtotal - total);
    const savingPct     = subtotal > 0 ? (saving / subtotal) * 100 : 0;
    const fixedTooLow   = config.discount_type === "fixed" &&
                          config.fixed_price !== "" &&
                          Number(config.fixed_price) < subtotal * 0.1; // warn if <10% of cost
    return { subtotal, total, saving, savingPct, fixedTooLow };
  }, [components, config.discount_type, config.discount_pct, config.fixed_price]);

  // ── View: List ────────────────────────────────────────────────────────────

  if (view === "list") {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Layers size={20} className="text-primary" />
              Bundles & Kits
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              PC armadas, esquemas configurables y bundles genéricos.
            </p>
          </div>
          <Button onClick={openNewBuilder} className="gap-2">
            <Plus size={14} /> Crear bundle
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={28} />
          </div>
        ) : bundles.length === 0 ? (
          <Card className="text-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag size={24} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">No hay bundles creados aún.</p>
              <Button onClick={openNewBuilder} variant="outline" size="sm" className="gap-1.5">
                <Plus size={13} /> Crear primer bundle
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3">
            {bundles.map((bundle) => {
              const BIcon  = TYPE_ICONS[bundle.type] ?? Package;
              const bColor = TYPE_COLORS[bundle.type] ?? TYPE_COLORS.bundle;
              return (
                <Card key={bundle.id} className="hover:border-primary/40 transition-colors duration-150">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {bundle.image_url ? (
                        <img
                          src={bundle.image_url}
                          alt={bundle.title}
                          className="h-14 w-14 rounded-xl object-cover shrink-0 border border-border/60"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <ImageIcon size={18} className="text-muted-foreground/40" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm text-foreground truncate">{bundle.title}</span>
                          <Badge className={`gap-1 text-[10px] py-0 px-1.5 ${bColor}`}>
                            <BIcon size={8} />
                            {BUNDLE_TYPE_LABELS[bundle.type]}
                          </Badge>
                          {!bundle.active && (
                            <Badge variant="secondary" className="text-[10px] py-0">Inactivo</Badge>
                          )}
                          {bundle.discount_type === "percentage" && bundle.discount_pct > 0 && (
                            <Badge variant="outline" className="text-[10px] py-0 text-green-500 border-green-500/40">
                              <Tag size={8} className="mr-0.5" />-{bundle.discount_pct}%
                            </Badge>
                          )}
                          {bundle.discount_type === "fixed" && bundle.fixed_price != null && (
                            <Badge variant="outline" className="text-[10px] py-0 text-amber-500 border-amber-500/40">
                              Precio fijo
                            </Badge>
                          )}
                        </div>
                        {bundle.description && (
                          <p className="text-xs text-muted-foreground truncate">{bundle.description}</p>
                        )}
                        {bundle.slug && (
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">/{bundle.slug}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                          onClick={() => openEditBuilder(bundle)}
                        >
                          <Pencil size={12} /> Editar
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => handleToggleActive(bundle)}
                          title={bundle.active ? "Desactivar" : "Activar"}
                        >
                          <Power size={13} className={bundle.active ? "text-green-500" : "text-muted-foreground"} />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive/80"
                          onClick={() => handleDeleteBundle(bundle)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── View: Builder ─────────────────────────────────────────────────────────

  const TypeIcon  = TYPE_ICONS[config.type] ?? Package;
  const typeColor = TYPE_COLORS[config.type] ?? TYPE_COLORS.bundle;

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={13} /> Volver a la lista
        </button>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-foreground">
            {editingBundle ? `Editando: ${editingBundle.title}` : "Nuevo bundle"}
          </h2>
          <Badge className={`gap-1 text-[10px] py-0 px-1.5 ${typeColor}`}>
            <TypeIcon size={8} />
            {BUNDLE_TYPE_LABELS[config.type]}
          </Badge>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr_300px] xl:grid-cols-[360px_1fr_320px]">

        {/* ── COLUMNA 1: Configuración ──────────────────────────────────── */}
        <div className="space-y-4">

          {/* Card: Datos generales */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
                Datos generales
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre del bundle *</Label>
                <Input
                  value={config.title}
                  onChange={(e) => setConfig((p) => ({
                    ...p,
                    title: e.target.value,
                    slug: p.slug || titleToSlug(e.target.value),
                  }))}
                  placeholder="PC Gamer Entrada, Kit Oficina Pro..."
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Slug (URL)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/</span>
                  <Input
                    value={config.slug}
                    onChange={(e) => setConfig((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))}
                    placeholder="pc-gamer-entrada"
                    className="h-9 pl-6 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["bundle", "pc_armada", "esquema"] as BundleType[]).map((t) => {
                    const Icon  = TYPE_ICONS[t];
                    const color = TYPE_COLORS[t];
                    const active = config.type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setConfig((p) => ({ ...p, type: t }))}
                        className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] font-semibold transition
                          ${active ? `${color} border-current` : "border-border/60 text-muted-foreground hover:border-border"}`}
                      >
                        <Icon size={14} />
                        {BUNDLE_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {config.type === "pc_armada" && "Componentes fijos — el cliente los ve, no elige."}
                  {config.type === "esquema"   && "El cliente elige variante de cada componente."}
                  {config.type === "bundle"    && "Combo libre — mezcla fijos y opcionales."}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Descripción</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    disabled={components.length === 0}
                    onClick={handleGenerateDescription}
                  >
                    <Sparkles className="h-3 w-3" /> Auto-descripción
                  </Button>
                </div>
                <Textarea
                  value={config.description}
                  onChange={(e) => setConfig((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Descripción visible para el cliente..."
                  className="text-sm resize-none"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Imagen de portada</Label>

                {/* Upload button */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageFile(file);
                    // Local preview
                    setConfig(p => ({ ...p, image_url: URL.createObjectURL(file) }));
                  }}
                />

                {/* Preview + actions */}
                {(config.image_url || imageFile) ? (
                  <div className="relative group">
                    <img
                      src={config.image_url}
                      alt="preview"
                      className="h-28 w-full rounded-xl object-cover border border-border/40"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                    {imageFile && (
                      <div className="absolute top-1.5 left-1.5 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Sin subir — se guarda al crear/guardar
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setConfig(p => ({ ...p, image_url: "" })); }}
                      className="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs flex-1"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                  >
                    {imageUploading
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Subiendo...</>
                      : <><ImageIcon className="h-3 w-3" /> Subir imagen</>
                    }
                  </Button>
                  <Input
                    value={imageFile ? "" : config.image_url}
                    onChange={(e) => { setImageFile(null); setConfig((p) => ({ ...p, image_url: e.target.value })); }}
                    placeholder="o pegar URL..."
                    className="h-8 text-xs flex-1"
                    disabled={!!imageFile}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Precio y descuento */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
                Precio y descuento
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de descuento</Label>
                <select
                  value={config.discount_type}
                  onChange={(e) => setConfig((p) => ({ ...p, discount_type: e.target.value as DiscountType }))}
                  className="w-full h-9 text-sm rounded-lg border border-border/70 bg-background px-2"
                >
                  {(["percentage", "fixed", "none"] as DiscountType[]).map((t) => (
                    <option key={t} value={t}>{DISCOUNT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {config.discount_type === "percentage" && (
                <div className="space-y-1">
                  <Label className="text-xs">Descuento (%)</Label>
                  <div className="relative">
                    <Input
                      type="number" min={0} max={100} step={0.5}
                      value={config.discount_pct}
                      onChange={(e) => setConfig((p) => ({ ...p, discount_pct: Number(e.target.value) }))}
                      className="h-9 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              )}

              {config.discount_type === "fixed" && (
                <div className="space-y-1">
                  <Label className="text-xs">Precio fijo total ($)</Label>
                  <Input
                    type="number" min={0} step={1}
                    value={config.fixed_price}
                    onChange={(e) => setConfig((p) => ({ ...p, fixed_price: e.target.value }))}
                    placeholder="Ej: 850000"
                    className="h-9"
                  />
                  {summary.fixedTooLow && (
                    <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={11} />
                      El precio fijo es muy inferior al costo de los componentes.
                    </p>
                  )}
                </div>
              )}

              {config.discount_type === "none" && (
                <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                  Sin descuento — el cliente paga la suma de los componentes.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card: Opciones */}
          <Card>
            <CardContent className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Permite personalización</p>
                  <p className="text-[10px] text-muted-foreground">El cliente puede configurar slots</p>
                </div>
                <Switch
                  checked={config.allows_customization}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, allows_customization: v }))}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Activo</p>
                  <p className="text-[10px] text-muted-foreground">Visible en el portal cliente</p>
                </div>
                <Switch
                  checked={config.active}
                  onCheckedChange={(v) => setConfig((p) => ({ ...p, active: v }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── COLUMNA 2: Componentes ────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">

          {/* Product search */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
                Componentes del bundle
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => { setProductSearch(e.target.value); setShowSearch(true); }}
                    onFocus={() => setShowSearch(true)}
                    placeholder="Buscar producto por nombre o SKU..."
                    className="h-10 pl-8 text-sm"
                  />
                  {productSearch && (
                    <button
                      onClick={() => { setProductSearch(""); setShowSearch(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {showSearch && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1.5 rounded-xl border border-border/70 bg-card shadow-xl overflow-hidden">
                    {searchResults.map((product) => {
                      const alreadyAdded = components.some((c) => c.product.id === product.id);
                      const isLoading    = addingComponentId === product.id;
                      const stockOk      = (product.stock ?? 0) > 0;
                      return (
                        <button
                          key={product.id}
                          disabled={alreadyAdded || isLoading}
                          onClick={() => handleAddProduct(product)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition
                            hover:bg-muted/50 border-b border-border/40 last:border-0
                            ${alreadyAdded ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-9 w-9 rounded-lg object-cover shrink-0 border border-border/40" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                              <Package size={12} className="text-muted-foreground/50" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {product.sku && <span className="text-[10px] text-muted-foreground">SKU: {product.sku}</span>}
                              <span className={`text-[10px] font-medium ${stockOk ? "text-green-500" : "text-destructive"}`}>
                                {stockOk ? `${product.stock} en stock` : "Sin stock"}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-foreground">
                              ${adminPrice(product).toLocaleString("es-AR")}
                            </p>
                            {alreadyAdded ? (
                              <span className="text-[10px] text-muted-foreground">Ya incluido</span>
                            ) : isLoading ? (
                              <Loader2 size={12} className="animate-spin ml-auto" />
                            ) : (
                              <span className="text-[10px] text-primary font-semibold">+ Agregar</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showSearch && productSearch.trim() && searchResults.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1.5 rounded-xl border border-border/70 bg-card shadow-xl px-4 py-6 text-center">
                    <p className="text-xs text-muted-foreground">Sin resultados para "{productSearch}"</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Component list */}
          {components.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
                    <Sparkles size={20} className="text-primary/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Todavía no hay componentes</p>
                  <p className="text-xs text-muted-foreground/60">Buscá y agregá productos para armar tu bundle</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {components.map((comp, idx) => (
                <Card key={comp.localId} className="group hover:border-primary/30 transition-colors duration-100">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">

                      {/* Sort order up/down */}
                      <div className="flex flex-col gap-0.5 shrink-0 mt-1">
                        <button
                          disabled={idx === 0}
                          onClick={() => moveComponent(comp.localId, "up")}
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          disabled={idx === components.length - 1}
                          onClick={() => moveComponent(comp.localId, "down")}
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-20"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      {/* Product image */}
                      {comp.product.image ? (
                        <img
                          src={comp.product.image}
                          alt={comp.product.name}
                          className="h-11 w-11 rounded-xl object-cover shrink-0 border border-border/40"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                          <Package size={14} className="text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Info + controls */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{comp.product.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              ${adminPrice(comp.product).toLocaleString("es-AR")} por unidad
                              {comp.product.sku && ` · ${comp.product.sku}`}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveComponent(comp.localId)}
                            className="shrink-0 p-1 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        {/* Inline controls */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Quantity */}
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground shrink-0">Cant.</Label>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => patchComponent(comp.localId, { quantity: Math.max(1, comp.quantity - 1) })}
                                className="h-6 w-6 rounded-md border border-border/70 flex items-center justify-center text-xs hover:bg-muted"
                              >−</button>
                              <span className="w-7 text-center text-xs font-semibold text-foreground">{comp.quantity}</span>
                              <button
                                onClick={() => patchComponent(comp.localId, { quantity: comp.quantity + 1 })}
                                className="h-6 w-6 rounded-md border border-border/70 flex items-center justify-center text-xs hover:bg-muted"
                              >+</button>
                            </div>
                          </div>

                          {/* Optional */}
                          <label className={`flex items-center gap-1 rounded-full border px-2 py-0.5 cursor-pointer transition-colors ${comp.is_optional ? "border-amber-500/40 bg-amber-500/10" : "border-border/50"}`}>
                            <input
                              type="checkbox"
                              checked={comp.is_optional}
                              onChange={(e) => patchComponent(comp.localId, { is_optional: e.target.checked })}
                              className="sr-only"
                            />
                            <span className={`text-[10px] font-semibold ${comp.is_optional ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                              Opcional
                            </span>
                          </label>

                          {/* Replaceable */}
                          <label className={`flex items-center gap-1 rounded-full border px-2 py-0.5 cursor-pointer transition-colors ${comp.is_replaceable ? "border-blue-500/40 bg-blue-500/10" : "border-border/50"}`}>
                            <input
                              type="checkbox"
                              checked={comp.is_replaceable}
                              onChange={(e) => patchComponent(comp.localId, { is_replaceable: e.target.checked })}
                              className="sr-only"
                            />
                            <span className={`text-[10px] font-semibold ${comp.is_replaceable ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                              Reemplazable
                            </span>
                          </label>

                          {/* Client configurable */}
                          <label className={`flex items-center gap-1 rounded-full border px-2 py-0.5 cursor-pointer transition-colors ${comp.client_configurable ? "border-violet-500/40 bg-violet-500/10" : "border-border/50"}`}>
                            <input
                              type="checkbox"
                              checked={comp.client_configurable}
                              onChange={(e) => patchComponent(comp.localId, { client_configurable: e.target.checked })}
                              className="sr-only"
                            />
                            <span className={`text-[10px] font-semibold ${comp.client_configurable ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`}>
                              Cliente elige
                            </span>
                          </label>

                          {/* Subtotal */}
                          <span className="ml-auto text-xs font-bold text-foreground tabular-nums shrink-0">
                            ${(adminPrice(comp.product) * comp.quantity).toLocaleString("es-AR")}
                          </span>
                        </div>

                        {/* Alternatives section (expand) */}
                        <div>
                          <button
                            onClick={() => patchComponent(comp.localId, { expanded: !comp.expanded })}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {comp.expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            {comp.alternatives.length > 0
                              ? `${comp.alternatives.length} alternativa${comp.alternatives.length !== 1 ? "s" : ""}`
                              : "Agregar alternativas"}
                          </button>

                          {comp.expanded && (
                            <div className="mt-2 space-y-2 pl-2 border-l-2 border-border/40">
                              {/* Existing alternatives */}
                              {comp.alternatives.map((alt) => (
                                <div key={alt.localId} className="flex items-center gap-2">
                                  {alt.product.image ? (
                                    <img src={alt.product.image} alt={alt.product.name} className="h-7 w-7 rounded-lg object-cover border border-border/40 shrink-0" />
                                  ) : (
                                    <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                                      <Package size={10} className="text-muted-foreground/40" />
                                    </div>
                                  )}
                                  <span className="flex-1 text-xs text-foreground truncate">{alt.product.name}</span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    ${adminPrice(alt.product).toLocaleString("es-AR")}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveAlternative(comp.localId, alt.localId)}
                                    className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}

                              {/* Add alternative search */}
                              <div
                                ref={(el) => { altSearchRefs.current[comp.localId] = el; }}
                                className="relative"
                              >
                                <div className="relative">
                                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    value={altSearch[comp.localId] ?? ""}
                                    onChange={(e) => {
                                      setAltSearch((prev) => ({ ...prev, [comp.localId]: e.target.value }));
                                      setShowAltSearch((prev) => ({ ...prev, [comp.localId]: true }));
                                    }}
                                    onFocus={() => setShowAltSearch((prev) => ({ ...prev, [comp.localId]: true }))}
                                    placeholder="Buscar producto alternativo..."
                                    className="h-8 pl-7 text-xs"
                                  />
                                </div>
                                {showAltSearch[comp.localId] && altSearchResults(comp.localId).length > 0 && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border/70 bg-card shadow-xl overflow-hidden">
                                    {altSearchResults(comp.localId).map((p) => {
                                      const taken = p.id === comp.product.id || comp.alternatives.some((a) => a.product.id === p.id);
                                      return (
                                        <button
                                          key={p.id}
                                          disabled={taken || addingAltId === comp.localId}
                                          onClick={() => handleAddAlternative(comp.localId, p)}
                                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-muted/50 border-b border-border/40 last:border-0 ${taken ? "opacity-40 cursor-not-allowed" : ""}`}
                                        >
                                          <span className="flex-1 truncate">{p.name}</span>
                                          <span className="shrink-0 text-muted-foreground">${adminPrice(p).toLocaleString("es-AR")}</span>
                                          {taken ? (
                                            <span className="shrink-0 text-[10px] text-muted-foreground">Ya incluido</span>
                                          ) : addingAltId === comp.localId ? (
                                            <Loader2 size={11} className="animate-spin shrink-0" />
                                          ) : (
                                            <Plus size={11} className="shrink-0 text-primary" />
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── COLUMNA 3: Resumen ────────────────────────────────────────── */}
        <div className="sticky top-4 space-y-4 self-start">
          <Card className="overflow-hidden">
            <div className={`px-4 pt-4 pb-3 bg-gradient-to-br ${
              config.type === "pc_armada" ? "from-blue-500/10 to-blue-500/5" :
              config.type === "esquema"   ? "from-violet-500/10 to-violet-500/5" :
                                           "from-primary/10 to-primary/5"
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <TypeIcon size={14} className={
                  config.type === "pc_armada" ? "text-blue-500" :
                  config.type === "esquema"   ? "text-violet-500" :
                                               "text-primary"
                } />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {BUNDLE_TYPE_LABELS[config.type]}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground line-clamp-2">
                {config.title || <span className="text-muted-foreground italic">Sin nombre</span>}
              </p>
              {config.slug && (
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">/{config.slug}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {components.length} componente{components.length !== 1 ? "s" : ""}
                {components.some((c) => c.is_optional) && (
                  <span className="ml-1 text-amber-500">
                    · {components.filter((c) => c.is_optional).length} opcionales
                  </span>
                )}
                {components.some((c) => c.alternatives.length > 0) && (
                  <span className="ml-1 text-violet-500">
                    · {components.reduce((s, c) => s + c.alternatives.length, 0)} alternativas
                  </span>
                )}
              </p>
            </div>

            <CardContent className="px-4 pb-4 pt-3 space-y-3">
              {components.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  {components.slice(0, 5).map((comp) => (
                    <div key={comp.localId} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                      <span className="text-muted-foreground truncate flex-1">{comp.product.name}</span>
                      {comp.quantity > 1 && <span className="shrink-0 text-muted-foreground/60">×{comp.quantity}</span>}
                      {comp.is_optional && <span className="shrink-0 text-[9px] text-amber-500/70 font-medium">opc.</span>}
                      {comp.alternatives.length > 0 && (
                        <span className="shrink-0 text-[9px] text-violet-500/70">+{comp.alternatives.length}</span>
                      )}
                    </div>
                  ))}
                  {components.length > 5 && (
                    <p className="text-[10px] text-muted-foreground/60 italic pl-3.5">+{components.length - 5} más...</p>
                  )}
                </div>
              )}

              {components.length > 0 && <Separator />}

              {/* Pricing breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Precio sin descuento</span>
                  <span className="tabular-nums">${summary.subtotal.toLocaleString("es-AR")}</span>
                </div>

                {summary.saving > 0 && (
                  <div className="flex justify-between text-green-500 text-xs">
                    <span>
                      {config.discount_type === "percentage" ? `-${config.discount_pct}%` : "Precio fijo"}
                    </span>
                    <span className="tabular-nums">-${summary.saving.toLocaleString("es-AR")}</span>
                  </div>
                )}

                {/* Warning: fixed_price < component sum */}
                {config.discount_type === "fixed" && config.fixed_price &&
                 Number(config.fixed_price) < summary.subtotal && (
                  <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                    <span>Precio fijo (${Number(config.fixed_price).toLocaleString("es-AR")}) menor al costo de componentes.</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-foreground">
                  <span>Total final</span>
                  <span className="tabular-nums text-lg">${summary.total.toLocaleString("es-AR")}</span>
                </div>

                {summary.saving > 0 && (
                  <div className="flex items-center justify-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 py-1.5 px-3">
                    <Sparkles size={11} className="text-green-500" />
                    <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                      Ahorro de ${summary.saving.toLocaleString("es-AR")} ({Math.round(summary.savingPct)}%)
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !config.title.trim()}
                  className="w-full gap-2 h-10 font-bold"
                  size="lg"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingBundle ? "Guardar cambios" : "Crear bundle"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-9 text-sm"
                  onClick={() => setView("list")}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>

          {components.length === 0 && (
            <Card className="border-dashed bg-muted/10">
              <CardContent className="px-4 py-4 text-center space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Tip</p>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Buscá productos en la columna central y agregá los componentes de tu bundle.
                  Podés agregar alternativas por slot para que el cliente elija.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
