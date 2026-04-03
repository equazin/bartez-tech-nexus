import { supabase } from "@/lib/supabase";

export interface EmailTemplate {
  subject: string;
  body: string;
  type: "weekly_report" | "order_update" | "credit_alert" | "project_feedback";
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
   * Notifica cambio de estado en un pedido (vínculo con Logística).
   */
  async notifyOrderStatus(clientEmail: string, orderNumber: string, status: string, trackingInfo?: { carrier: string; id: string }) {
    const subject = `📦 Pedido ${orderNumber}: ${status.toUpperCase()}`;
    let body = `<h3> Actualización de su pedido ${orderNumber} </h3>`;
    body += `<p>El estado de su pedido ha cambiado a: <strong>${status}</strong></p>`;
    
    if (trackingInfo) {
      body += `<p>Puede realizar el seguimiento en ${trackingInfo.carrier} con el código: <strong>${trackingInfo.id}</strong></p>`;
    }
    
    return { success: true };
  }
};
