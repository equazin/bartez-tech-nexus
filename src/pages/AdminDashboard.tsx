import { useEffect, useState } from "react";
import { getStoredOrders } from "@/store/orderStore";
import { getStoredProducts } from "@/store/productStore";
import { getProducts as getSupplierProducts } from "@/services/supplierService";
import Layout from "@/components/Layout";
import { Order } from "@/models/order";
import { Product } from "@/models/products";

type Supplier = {
  id?: number;
  name?: string;
};

const AdminDashboard = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [recentActivity, setRecentActivity] = useState<Order[]>([]);

  useEffect(() => {
    const storedProducts = getStoredProducts();
    const storedOrders = getStoredOrders();

    setProducts(storedProducts);
    setOrders(storedOrders);

    // Últimas 5 órdenes
    setRecentActivity(storedOrders.slice(-5).reverse());

    // Suppliers async (seguro)
    let mounted = true;

    getSupplierProducts()
      .then((data) => {
        if (mounted) setSuppliers(data || []);
      })
      .catch(() => {
        if (mounted) setSuppliers([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Layout>
      <section className="min-h-[calc(100vh-96px)] py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-8">

          <h1 className="text-3xl font-bold mb-8">
            Dashboard Bartez
          </h1>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <StatCard title="Productos" value={products.length} />
            <StatCard title="Pedidos" value={orders.length} />
            <StatCard title="Proveedores" value={suppliers.length} />
            <StatCard title="Actividad reciente" value={recentActivity.length} />
          </div>

          {/* BLOQUES */}
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <Box title="Productos" value={products.length} />
            <Box title="Proveedores" value={suppliers.length} />
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <Box title="Pedidos" value={orders.length} />
            <Box title="Importaciones" value="(CSV / APIs próximamente)" />
          </div>

          {/* ACTIVIDAD */}
          <div>
            <h2 className="text-xl font-semibold mb-4">
              Actividad Reciente
            </h2>

            <div className="bg-background rounded-lg border p-4">
              {recentActivity.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Sin actividad reciente.
                </div>
              ) : (
                <ul className="text-sm space-y-2">
                  {recentActivity.map((order) => (
                    <li key={order.id}>
                      <span className="font-semibold">
                        Pedido #{order.id}
                      </span>{" "}
                      - {order.status} -{" "}
                      {new Date(order.created_at).toLocaleString()} - $
                      {order.total.toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </section>
    </Layout>
  );
};

/* COMPONENTES UI REUTILIZABLES */

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow border">
      <div className="text-2xl font-bold text-[#2D9F6A]">
        {value}
      </div>
      <div className="text-sm text-muted-foreground">
        {title}
      </div>
    </div>
  );
}

function Box({ title, value }: { title: string; value: any }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="bg-background rounded-lg border p-4">
        <div className="text-sm">Total: {value}</div>
      </div>
    </div>
  );
}

export default AdminDashboard;