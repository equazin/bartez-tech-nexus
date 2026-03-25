import { useState, useEffect } from "react";
import { Order } from "@/models/order";
import { getStoredOrders, saveOrders } from "@/store/orderStore";
import Layout from "@/components/Layout";
import ProductForm from "@/components/admin/ProductForm";
import ProductImport from "@/components/admin/ProductImport";
import { getStoredProducts } from "@/store/productStore";
import { Product } from "@/models/products";

const Admin = () => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  useEffect(() => {
    setProducts(getStoredProducts());
    setOrders(getStoredOrders());
  }, []);

  function handleProductAdd() {
    setProducts(getStoredProducts());
  }

  function handleImport(result: { imported: number; errors: string[] }) {
    setProducts(getStoredProducts());
    setImportResult(result);
  }

  function updateOrderStatus(orderId: number, status: "approved" | "rejected") {
    const updated = orders.map(o =>
      o.id === orderId ? { ...o, status } : o
    );
    setOrders(updated);
    saveOrders(updated);
  }

  return (
    <Layout>
      <section className="min-h-[calc(100vh-96px)] py-12 lg:py-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="rounded-2xl border border-border/40 bg-surface/90 p-8 shadow-xl">

            <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

            {/* PRODUCTS */}
            <div className="mb-10">
              <h2 className="text-xl font-semibold mb-4">Productos</h2>

              <div className="grid md:grid-cols-2 gap-8">
                <ProductForm onAdd={handleProductAdd} />
                <ProductImport onImport={handleImport} />
              </div>

              {importResult && (
                <div className="mt-4 text-sm">
                  <span className="font-semibold">
                    Importados: {importResult.imported}
                  </span>
                  {importResult.errors.length > 0 && (
                    <ul className="text-red-500 mt-1">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-8">
                <h4 className="font-semibold mb-2">
                  Productos ({products.length})
                </h4>

                <table className="w-full text-xs border">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Precio</th>
                      <th>Categoría</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>${p.cost_price}</td>
                        <td>{p.category}</td>
                        <td>{p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ORDERS */}
            <h2 className="text-xl font-semibold mb-4">Pedidos</h2>

            <table className="w-full text-sm mb-8">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.client_id}</td>
                    <td>{new Date(order.created_at).toLocaleString()}</td>
                    <td>{order.status}</td>
                    <td className="text-right">${order.total.toLocaleString()}</td>

                    <td className="text-center flex gap-2 justify-center">
                      <button onClick={() => setSelectedOrder(order)}>
                        Ver
                      </button>

                      {order.status === "pending" && (
                        <>
                          <button
                            className="text-green-600"
                            onClick={() => updateOrderStatus(order.id, "approved")}
                          >
                            Aprobar
                          </button>

                          <button
                            className="text-red-600"
                            onClick={() => updateOrderStatus(order.id, "rejected")}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ORDER DETAIL */}
            {selectedOrder && (
              <div className="border p-4 rounded mt-4">
                <h3 className="font-bold mb-2">
                  Pedido #{selectedOrder.id}
                </h3>

                <p>Cliente: {selectedOrder.client_id}</p>
                <p>Fecha: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                <p>Estado: {selectedOrder.status}</p>

                <table className="w-full text-sm mt-4">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Costo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedOrder.products.map(p => (
                      <tr key={p.product_id}>
                        <td>{p.name}</td>
                        <td>{p.quantity}</td>
                        <td>${p.cost_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  className="mt-4"
                  onClick={() => setSelectedOrder(null)}
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Admin;