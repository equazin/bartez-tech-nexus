export interface Product {
  id: number;
  name: string;
  description: string;
  image: string;
  cost_price: number;
  category: string;
  stock: number;
  sku?: string;
  supplier_id?: number;
  supplier_name?: string;
  supplier_multiplier?: number;
  stock_min?: number;
  external_id?: string;
  active?: boolean;
  featured?: boolean;
  specs?: Record<string, string>;
  tags?: string[];
  iva_rate?: number;
  /** Minimum units per order (pedido mínimo por producto) */
  min_order_qty?: number;
  /** Units reserved by pending orders */
  stock_reserved?: number;
  /** Price tiers for volume pricing */
  price_tiers?: Array<{ min: number; max: number | null; price: number }>;
  /** Original name from supplier API — never overwritten on re-sync */
  name_original?: string;
  /** Admin override for display name; takes priority over name_original */
  name_custom?: string;
}

/** Returns the display name: custom override → original → name */
export function displayName(p: Pick<Product, "name" | "name_original" | "name_custom">): string {
  return p.name_custom?.trim() || p.name_original?.trim() || p.name;
}

export const products: Product[] = [
	{
		id: 1,
		name: "Servidor Empresarial X100",
		description: "Servidor de rack 1U con 64GB RAM y 2TB SSD para cargas críticas.",
		image: "https://via.placeholder.com/320x200.png?text=Servidor+X100",
		cost_price: 12500,
		category: "Infraestructura",
		stock: 10,
	},
	{
		id: 2,
		name: "Switch PoE 24 Puertos",
		description: "Switch gestionado para redes con soporte PoE+ y monitoreo avanzado.",
		image: "https://via.placeholder.com/320x200.png?text=Switch+PoE",
		cost_price: 3200,
		category: "Redes",
		stock: 15,
	},
	{
		id: 3,
		name: "Laptop Corporativa 15",
		description: "Notebook empresarial con CPU i7, 16GB RAM y SSD 512GB.",
		image: "https://via.placeholder.com/320x200.png?text=Laptop+15",
		cost_price: 2800,
		category: "Equipamiento",
		stock: 8,
	},
	{
		id: 4,
		name: "Firewall UTM Avanzado",
		description: "Appliance de seguridad con IPS, VPN y filtrado de aplicaciones.",
		image: "https://via.placeholder.com/320x200.png?text=Firewall+UTM",
		cost_price: 7600,
		category: "Seguridad",
		stock: 5,
	},
	{
		id: 5,
		name: "Backup NAS 20TB",
		description: "Sistema de almacenamiento en red para backup empresarial.",
		image: "https://via.placeholder.com/320x200.png?text=NAS+20TB",
		cost_price: 5400,
		category: "Almacenamiento",
		stock: 6,
	},
];