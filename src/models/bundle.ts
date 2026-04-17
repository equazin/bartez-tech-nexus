/**
 * Tipos del dominio de Bundles/Kits.
 * Los slots referencian categorías internas (category_mapping — única fuente de verdad).
 *
 * Tipos de bundle:
 *   'pc_armada'  → Componentes fijos. El cliente ve los items pero no elige.
 *   'esquema'    → Slots configurables. El cliente elige variante por categoría.
 *   'bundle'     → Combo genérico. Mezcla libre de fijos y opcionales.
 */

export type BundleType = "bundle" | "pc_armada" | "esquema";
export type DiscountType = "percentage" | "fixed" | "none";

export interface Bundle {
  id: string;
  title: string;
  description: string | null;
  /** Tipo visual y de comportamiento del bundle. */
  type: BundleType;
  /** Slug URL-friendly, auto-generado desde el título si no se provee. */
  slug: string | null;
  /** URL de imagen de portada (opcional). */
  image_url: string | null;
  /** Tipo de descuento aplicado al precio calculado. */
  discount_type: DiscountType;
  /** Porcentaje de descuento (usado cuando discount_type = 'percentage'). */
  discount_pct: number;
  /** Precio final fijo (override total cuando discount_type = 'fixed'). */
  fixed_price: number | null;
  /** Si el cliente puede personalizar slots marcados como client_configurable. */
  allows_customization: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BundleSlot {
  id: string;
  bundle_id: string;
  /** Nombre visible del slot (Procesador, RAM, GPU, etc.). */
  label: string;
  category_id: number | null;
  required: boolean;
  /** El cliente puede elegir entre las opciones de este slot. */
  client_configurable: boolean;
  sort_order: number;
  created_at: string;
}

export interface BundleSlotOption {
  id: string;
  slot_id: string;
  product_id: number;
  is_default: boolean;
  sort_order: number;
  /** Unidades de este producto en el slot (default: 1). */
  quantity: number;
  /** El cliente puede omitir este item del bundle. */
  is_optional: boolean;
  /** El cliente puede reemplazar este item con otro del catálogo libre. */
  is_replaceable: boolean;
  created_at: string;
}

/** Opción enriquecida con datos del producto para mostrar en el portal. */
export interface BundleSlotOptionWithProduct extends BundleSlotOption {
  product: {
    id: number;
    name: string;
    sku: string | null;
    unit_price: number;
    cost_price: number | null;
    stock: number;
    image: string;
    category: string;
  };
}

/** Slot con sus opciones enriquecidas (para el portal cliente). */
export interface BundleSlotWithOptions extends BundleSlot {
  options: BundleSlotOptionWithProduct[];
}

/** Bundle completo con slots y opciones (para el portal cliente). */
export interface BundleWithSlots extends Bundle {
  slots: BundleSlotWithOptions[];
}

/**
 * Selección actual del cliente:
 *   - map de slot_id → product_id (null = slot omitido si es opcional)
 */
export type BundleSelection = Record<string, number | null>;

/** Labels visuales por tipo de bundle. */
export const BUNDLE_TYPE_LABELS: Record<BundleType, string> = {
  bundle:    "Kit",
  pc_armada: "PC Armada",
  esquema:   "Esquema",
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: "% sobre precio",
  fixed:      "Precio fijo",
  none:       "Sin descuento",
};
