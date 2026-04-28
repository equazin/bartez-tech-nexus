export type ManualPublicPosKitItem = {
  sku: string | null;
  name: string;
  category: string;
  quantity: number;
};

export type ManualPublicPosKit = {
  id: string;
  name: string;
  description: string;
  stock: number;
  priceUsd: number;
  image: string | null;
  badge: string | null;
  ctaLabel: string;
  whatsappMessage: string | null;
  barposIncluded: boolean;
  items: ManualPublicPosKitItem[];
};

// Edit this list to publish POS combo options that do not exist as products in the B2B portal.
// priceUsd is the public combo price before IVA. stock is the available combo quantity to show.
export const MANUAL_PUBLIC_POS_KITS: ManualPublicPosKit[] = [
  {
    id: "comercio-esencial",
    name: "Comercio Esencial",
    description: "Terminal, impresora y lector para abrir caja con una base operativa completa.",
    stock: 3,
    priceUsd: 775,
    image: null,
    badge: "Ideal kioscos",
    ctaLabel: "Comprar",
    whatsappMessage: null,
    barposIncluded: false,
    items: [
      {
        sku: "COMBO-POS-ESENCIAL",
        name: "Terminal POS touch para caja",
        category: "Terminales POS",
        quantity: 1,
      },
      {
        sku: "IMP-80-COMBO",
        name: "Impresora termica 80 mm",
        category: "Impresoras termicas",
        quantity: 1,
      },
      {
        sku: "LECTOR-2D-COMBO",
        name: "Lector de codigo 1D/2D",
        category: "Lectores de codigo",
        quantity: 1,
      },
    ],
  },
  {
    id: "etiquetado-stock",
    name: "Etiquetado y Stock",
    description: "Impresion de etiquetas y lectura 1D/2D para inventario, deposito y mostrador.",
    stock: 9,
    priceUsd: 390,
    image: null,
    badge: "Inventario",
    ctaLabel: "Consultar combo",
    whatsappMessage: null,
    barposIncluded: false,
    items: [
      {
        sku: "IMP-ETQ-COMBO",
        name: "Impresora de etiquetas",
        category: "Impresoras termicas",
        quantity: 1,
      },
      {
        sku: "LECTOR-2D-STOCK",
        name: "Lector de codigo 1D/2D para inventario",
        category: "Lectores de codigo",
        quantity: 1,
      },
    ],
  },
  {
    id: "caja-pro",
    name: "Caja Pro",
    description: "Equipo POS de mayor capacidad con impresion de tickets y lector para alto movimiento.",
    stock: 1,
    priceUsd: 940,
    image: null,
    badge: "Alto movimiento",
    ctaLabel: "Comprar",
    whatsappMessage: null,
    barposIncluded: false,
    items: [
      {
        sku: "COMBO-POS-PRO",
        name: "Terminal POS touch de alto rendimiento",
        category: "Terminales POS",
        quantity: 1,
      },
      {
        sku: "IMP-80-PRO",
        name: "Impresora termica 80 mm para tickets",
        category: "Impresoras termicas",
        quantity: 1,
      },
      {
        sku: "LECTOR-2D-PRO",
        name: "Lector omnidireccional 1D/2D",
        category: "Lectores de codigo",
        quantity: 1,
      },
    ],
  },
];
