import { Order } from "@/models/order";

const ORDER_KEY = "b2b_orders";

export function getStoredOrders(): Order[] {
  const raw = localStorage.getItem(ORDER_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveOrders(orders: Order[]) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(orders));
}

export function addOrder(order: Order) {
  const orders = getStoredOrders();
  orders.push(order);
  saveOrders(orders);
}
