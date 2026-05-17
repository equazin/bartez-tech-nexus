import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { InvoicesPanel } from "@/components/b2b/InvoicesPanel";
import { useOrders } from "@/hooks/useOrders";
import { fetchMyInvoices, type Invoice } from "@/lib/api/invoices";

export function PortalInvoicesSection() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyInvoices()
      .then((data) => { if (!cancelled) setInvoices(data); })
      .catch(() => { /* non-blocking */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <InvoicesPanel
      invoices={invoices}
      orders={orders}
      loading={loading}
      onGoToOrders={() => navigate("/portal/pedidos")}
    />
  );
}
