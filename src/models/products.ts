export interface PriceTier {
  min: number;
  max: number | null;
  price: number;
}

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
  supplier_uuid?: string;
  supplier_name?: string;
  supplier_multiplier?: number;
  stock_min?: number;
  external_id?: string;
  active?: boolean;
  featured?: boolean;
  specs?: Record<string, string>;
  tags?: string[];
  iva_rate?: number;
  /** Precio escalonado por volumen (mayorista) */
  price_tiers?: PriceTier[];
  /** Stock comprometido en pedidos pendientes */
  stock_reserved?: number;
  /** Cantidad mínima de compra por pedido */
  min_order_qty?: number;
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
		stock_reserved: 0,
		sku: "SRV-X100",
		price_tiers: [
			{ min: 1,  max: 2,    price: 12500 },
			{ min: 3,  max: 9,    price: 11800 },
			{ min: 10, max: null, price: 10900 },
		],
	},
	{
		id: 2,
		name: "Switch PoE 24 Puertos",
		description: "Switch gestionado para redes con soporte PoE+ y monitoreo avanzado.",
		image: "https://via.placeholder.com/320x200.png?text=Switch+PoE",
		cost_price: 3200,
		category: "Redes",
		stock: 15,
		stock_reserved: 0,
		sku: "NET-SW24",
		price_tiers: [
			{ min: 1,  max: 9,    price: 3200 },
			{ min: 10, max: 49,   price: 2900 },
			{ min: 50, max: null, price: 2600 },
		],
	},
	{
		id: 3,
		name: "Laptop Corporativa 15",
		description: "Notebook empresarial con CPU i7, 16GB RAM y SSD 512GB.",
		image: "https://via.placeholder.com/320x200.png?text=Laptop+15",
		cost_price: 2800,
		category: "Equipamiento",
		stock: 8,
		stock_reserved: 2,
		sku: "LAP-C15I7",
		price_tiers: [
			{ min: 1,  max: 9,    price: 2800 },
			{ min: 10, max: 49,   price: 2550 },
			{ min: 50, max: null, price: 2300 },
		],
	},
	{
		id: 4,
		name: "Firewall UTM Avanzado",
		description: "Appliance de seguridad con IPS, VPN y filtrado de aplicaciones.",
		image: "https://via.placeholder.com/320x200.png?text=Firewall+UTM",
		cost_price: 7600,
		category: "Seguridad",
		stock: 5,
		stock_reserved: 0,
		sku: "SEC-UTM01",
		price_tiers: [
			{ min: 1, max: 4,    price: 7600 },
			{ min: 5, max: null, price: 7000 },
		],
	},
	{
		id: 5,
		name: "Backup NAS 20TB",
		description: "Sistema de almacenamiento en red para backup empresarial.",
		image: "https://via.placeholder.com/320x200.png?text=NAS+20TB",
		cost_price: 5400,
		category: "Almacenamiento",
		stock: 6,
		stock_reserved: 0,
		sku: "STR-NAS20",
		price_tiers: [
			{ min: 1, max: 9,    price: 5400 },
			{ min: 10, max: null, price: 4900 },
		],
	},
];