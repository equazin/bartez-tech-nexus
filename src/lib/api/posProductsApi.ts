export interface PublicPosProduct {
  id: number;
  sku: string | null;
  name: string;
  category: string;
  brand: string | null;
  image: string | null;
  stock: number;
  priceUsd: number;
  ivaRate: number;
}

export interface PublicPosKitItem {
  sku: string | null;
  name: string;
  category: string;
  quantity: number;
}

export interface PublicPosKit {
  id: string;
  name: string;
  description: string;
  image: string | null;
  badge: string | null;
  ctaLabel: string;
  whatsappMessage: string | null;
  barposIncluded: boolean;
  items: PublicPosKitItem[];
  priceUsd: number;
  stock: number;
}

export interface PublicPosCatalog {
  products: PublicPosProduct[];
  kits: PublicPosKit[];
  meta: {
    marginPct: number;
    count: number;
  };
}

export async function fetchPublicPosCatalog(): Promise<PublicPosCatalog> {
  const response = await fetch("/api/pos-products");
  const payload = (await response.json()) as {
    ok?: boolean;
    data?: PublicPosCatalog;
    error?: string;
  };

  if (!response.ok || payload.ok === false || !payload.data) {
    throw new Error(payload.error || "No se pudo cargar Punto de Venta.");
  }

  return payload.data;
}
