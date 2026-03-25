export interface OrderProduct {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  id: number;
  client: string;
  status: string;
  date: string;
  products: OrderProduct[];
  total: number;
}

export const mockOrders: Order[] = [
  {
    id: 1,
    client: "admin@demo.com",
    status: "Pending approval",
    date: "2026-03-21",
    products: [
      { id: 1, name: "Servidor Empresarial X100", quantity: 2, price: 15000, total: 30000 },
      { id: 3, name: "Laptop Corporativa 15", quantity: 1, price: 3500, total: 3500 },
    ],
    total: 33500,
  },
  {
    id: 2,
    client: "cliente@empresa.com",
    status: "Pending approval",
    date: "2026-03-20",
    products: [
      { id: 4, name: "Firewall UTM Avanzado", quantity: 1, price: 9000, total: 9000 },
    ],
    total: 9000,
  },
];
