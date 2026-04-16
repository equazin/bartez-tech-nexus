/**
 * Tipos del dominio de Bundles/Kits.
 * Los slots referencian categorías internas (category_mapping — única fuente de verdad).
 */

export interface Bundle {
  id: string;
  title: string;
  description: string | null;
  discount_pct: number;
  allows_customization: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BundleSlot {
  id: string;
  bundle_id: string;
  label: string;
  category_id: number | null;
  required: boolean;
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
 * Selección actual del cliente: map de slot_id → product_id.
 * Los slots sin selección no aparecen en el mapa.
 */
export type BundleSelection = Record<string, number>;
