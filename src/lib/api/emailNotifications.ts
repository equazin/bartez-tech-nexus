import { supabase } from "@/lib/supabase";

export interface EmailTemplate {
  subject: string;
  body: string;
  type: "weekly_report" | "order_update" | "credit_alert" | "project_feedback" | "new_payment";
}

/**
 * Servicio centralizado para notificaciones por Email y Sistema.
 * Preparado para integración con Resend / SendGrid / Amazon SES.
 */
export const EmailNotificationService = {
  
  /**
   * Envía un reporte semanal resumido al Administrador.
   */
  async sendWeeklyAdminReport(adminEmail: string, data: {
    newPartners: number;
    pendingApprovals: number;
    totalSalesUSD: number;
    topProject: string;
    criticalStockSkus: number;
  }) {
    console.log(`[EmailService] Generando Weekly Pulse para ${adminEmail}...`);
    
    const subject = `📊 Bartez B2B: Resumen Semanal de Operaciones`;
    const body = `
      <h1>Informe Semanal de Gestión B2B</h1>
      <p>Hola Bartez Admin, aquí tienes un resumen de la actividad:</p>
      <ul>
        <li><strong>Nuevos Partners:</strong> ${data.newPartners} registrados esta semana.</li>
        <li><strong>Aprobaciones Pendientes:</strong> ${data.pendingApprovals} solicitudes esperando revisión.</li>
        <li><strong>Proyectos Top:</strong> "${data.topProject}" lidera el pipeline.</li>
        <li><strong>Volumen de Ventas:</strong> USD ${data.totalSalesUSD.toLocaleString()} proyectados.</li>
        <li><strong>Riesgo de Stock:</strong> ${data.criticalStockSkus} productos requieren reposición inmediata.</li>
      </ul>
      <br/>
      <a href="https://bartez.com.ar/admin" style="background:#2D9F6A; color:#fff; padding:10px 20px; border-radius:8px; text-decoration:none;">Acceder al Panel Admin</a>
    `;

    // En producción: fetch("/api/send-email", { to: adminEmail, subject, body });
    return { success: true, sentAt: new Date().toISOString() };
  },

  /**
   * Notifica al cliente cuando se actualiza su línea de crédito.
   */
  async notifyCreditUpdate(clientEmail: string, newLimit: number, companyName: string) {
    console.log(`[EmailService] Notificando crédito a ${clientEmail}...`);
    const subject = `✅ Su línea de crédito en Bartez ha sido actualizada`;
    const body = `
      <h2>¡Buenas noticias, ${companyName}!</h2>
      <p>Su solicitud de crédito ha sido procesada con éxito.</p>
      <p><strong>Nuevo Límite Disponible:</strong> USD ${newLimit.toLocaleString()}</p>
      <p>Ya puede utilizar este saldo para pedidos directos y reserva de stock.</p>
    `;
    return { success: true };
  },

  /**
   * Notifica cambio de estado en un pedido y registra en order_email_logs.
   */
  async notifyOrderStatus(orderId: string | number, status: string) {
    try {
      const typeMap: Record<string, string> = {
        approved: "order_approved",
        preparing: "order_preparing",
        shipped: "order_shipped",
        delivered: "order_delivered",
        rejected: "order_rejected",
      };
      
      const emailType = typeMap[status];
      if (!emailType) return { success: false, reason: "No email template for this status" };

      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
        
      if (error || !order) return { success: false, error: "Order not found" };

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, contact_name, email")
        .eq("id", order.client_id)
        .single();

      const clientEmail = profile?.email;
      if (!clientEmail) return { success: false, reason: "Client missing email" };

      const clientName = profile?.company_name || profile?.contact_name || "Cliente";

      const payload = {
        type: emailType,
        orderId: Number(order.id),
        orderNumber: order.order_number || `#${String(order.id).slice(-6).toUpperCase()}`,
        clientId: order.client_id,
        clientEmail,
        clientName,
        products: order.products || [],
        total: order.total,
        shippingProvider: order.shipping_provider,
        trackingNumber: order.tracking_number,
      };

      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Email API failed: ${await res.text()}`);

      // Registrar log de evento
      await supabase.from("order_email_logs").insert({
        order_id: order.id,
        email: clientEmail,
        tipo: emailType,
        status: "sent",
      });

      console.log(`[EmailService] Email '${emailType}' enviado para orden ${orderId}`);
      return { success: true };
    } catch (err) {
      console.error("[EmailService] Error enviando email de estado:", err);
      
      // Registrar log manual si hubiese fallado globalmente e interesa
      try {
        await supabase.from("order_email_logs").insert({
          order_id: typeof orderId === 'number' ? orderId : null,
          email: "unknown",
          tipo: status,
          status: "failed",
        });
      } catch (logError) {
        console.warn("[EmailService] No se pudo registrar el fallo del email:", logError);
      }

      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Notifica a ventas sobre un nuevo comprobante subido por el cliente.
   */
  async notifyNewPayment(data: {
    clientName: string;
    amount: number;
    currency: string;
    date: string;
    method: string;
    orderNumber?: string;
    invoiceNumber?: string;
    fileUrl?: string;
    notes?: string;
  }) {
    console.log(`[EmailService] Notificando nuevo pago de ${data.clientName}...`);
    
    const payload = {
      type: "new_payment",
      to: "ventas@bartez.com.ar",
      clientName: data.clientName,
      amount: data.amount,
      currency: data.currency,
      date: data.date,
      method: data.method,
      orderNumber: data.orderNumber,
      invoiceNumber: data.invoiceNumber,
      fileUrl: data.fileUrl,
      notes: data.notes,
    };

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Email API failed: ${await res.text()}`);
      return { success: true };
    } catch (err) {
      console.error("[EmailService] Error enviando notificación de pago:", err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};
