import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

// ── Brand tokens ──────────────────────────────────────────────────────────
const C = {
  green:      [45, 159, 106]  as [number, number, number],
  greenLight: [232, 248, 240] as [number, number, number],
  greenBorder:[185, 225, 207] as [number, number, number],
  dark:       [18, 18, 18]    as [number, number, number],
  charcoal:   [32, 32, 32]    as [number, number, number],
  text:       [28, 28, 28]    as [number, number, number],
  muted:      [118, 118, 118] as [number, number, number],
  subtle:     [165, 165, 165] as [number, number, number],
  bg:         [248, 248, 248] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  border:     [218, 218, 218] as [number, number, number],
  borderDark: [195, 195, 195] as [number, number, number],
};

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15; // margin mm

// ── Public interface ──────────────────────────────────────────────────────
export interface QuotePDFOptions {
  clientName: string;
  companyName: string;
  /** URL or base64 data URL of the logo image */
  logoUrl?: string;
  logoBase64?: string;
  products: Array<{
    name: string;
    quantity: number;
    /** Unit price sin IVA */
    price: number;
    /** Subtotal sin IVA (price × qty) */
    total: number;
    ivaRate?: number;
    ivaAmount?: number;
    totalWithIVA?: number;
    margin?: number;
    cost?: number;
  }>;
  total: number;
  /** Pre-computed subtotal sin IVA — if provided, used directly */
  subtotal?: number;
  /** Pre-computed IVA total — if provided, used directly */
  ivaTotal?: number;
  date: string;
  showCost: boolean;
  /** "USD" (default) or "ARS" */
  currency?: "USD" | "ARS";
  /** Hide Bartez branding for resale to end clients */
  whiteLabel?: boolean;
  /** URL the QR code points to — defaults to www.bartez.com.ar */
  qrUrl?: string;
  /** Base64 PNG/JPG of a signature image */
  signatureImageBase64?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  /** Show an IVA breakdown in the total block */
  iva?: boolean;
  ivaRate?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function quoteNumber(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  const r = String(1000 + Math.floor(Math.random() * 9000));
  return `COT-${y}${m}${d}-${r}`;
}

function fmt(value: number, currency: "USD" | "ARS"): string {
  if (currency === "ARS") return "$ " + Math.round(value).toLocaleString("es-AR");
  return "USD " + Math.round(value).toLocaleString("en-US");
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildQR(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, {
      width: 140,
      margin: 1,
      color: { dark: "#1c1c1c", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────
export async function generateQuotePDF(opts: QuotePDFOptions) {
  const {
    clientName,
    companyName,
    products,
    date,
    showCost,
    currency = "USD",
    whiteLabel = false,
    qrUrl = "https://www.bartez.com.ar",
    validityDays = 7,
    paymentTerms = "Transferencia bancaria / Cheque",
    deliveryTerms = "A coordinar con el área comercial",
    iva = false,
  } = opts;

  const qNum       = quoteNumber();
  const brandName  = whiteLabel ? clientName : companyName;
  // Use pre-computed totals if provided (from cart), otherwise compute from products
  const subtotal   = opts.subtotal  ?? products.reduce((s, p) => s + p.total, 0);
  const ivaAmt     = iva ? (opts.ivaTotal ?? products.reduce((s, p) => s + (p.ivaAmount ?? 0), 0)) : 0;
  const grandTotal = opts.total;

  // Pre-load assets in parallel
  const [logoData, qrData] = await Promise.all([
    opts.logoBase64
      ? Promise.resolve(opts.logoBase64)
      : opts.logoUrl
        ? fetchAsDataUrl(opts.logoUrl)
        : fetchAsDataUrl("/icon.png"),
    !whiteLabel ? buildQR(qrUrl) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── Reusable drawing functions ──────────────────────────────────────────

  function setFont(size: number, style: "normal" | "bold" | "italic" = "normal") {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  }

  function setColor(c: [number, number, number]) {
    doc.setTextColor(c[0], c[1], c[2]);
  }

  function hLine(y: number, x1 = M, x2 = PAGE_W - M, color = C.border, lw = 0.3) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(lw);
    doc.line(x1, y, x2, y);
  }

  function tryAddImage(data: string, x: number, y: number, w: number, h: number) {
    try { doc.addImage(data, "PNG", x, y, w, h); } catch { /* skip */ }
  }

  /** Draw the compact header used on all content pages */
  function drawHeader() {
    // Logo
    if (logoData) tryAddImage(logoData, M, M, 20, 20);
    const textX = logoData ? M + 24 : M;

    setFont(12, "bold"); setColor(C.dark);
    doc.text(brandName, textX, M + 8);
    if (!whiteLabel) {
      setFont(7.5); setColor(C.muted);
      doc.text("Soluciones Tecnológicas Empresariales", textX, M + 14);
    }

    // Right: quote meta
    const rx = PAGE_W - M;
    setFont(8.5, "bold"); setColor(C.dark);
    doc.text(qNum, rx, M + 5, { align: "right" });
    setFont(8); setColor(C.muted);
    doc.text(`Fecha: ${date}`, rx, M + 11, { align: "right" });
    doc.text(`Cliente: ${clientName}`, rx, M + 17, { align: "right" });

    hLine(M + 22, M, PAGE_W - M, C.borderDark, 0.4);
  }

  /** Draw the footer used on all content pages */
  function drawFooter(pageNum: number, total: number) {
    const fy = PAGE_H - 13;
    hLine(fy - 3);
    setFont(7.5); setColor(C.muted);
    if (!whiteLabel) {
      doc.text(
        "Bartez Tecnología  ·  ventas@bartez.com.ar  ·  www.bartez.com.ar",
        PAGE_W / 2, fy + 1, { align: "center" }
      );
    }
    setColor(C.subtle);
    doc.text(`Página ${pageNum} de ${total}`, PAGE_W - M, fy + 1, { align: "right" });
  }

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ════════════════════════════════════════════════════════════════════════

  // Top green bar
  doc.setFillColor(...C.green);
  doc.rect(0, 0, PAGE_W, 11, "F");

  // Logo centered (large)
  if (logoData) {
    tryAddImage(logoData, PAGE_W / 2 - 20, 28, 40, 40);
  }

  // Company name
  const namY = logoData ? 82 : 70;
  setFont(26, "bold"); setColor(C.dark);
  doc.text(brandName, PAGE_W / 2, namY, { align: "center" });

  // Green accent line
  doc.setFillColor(...C.green);
  doc.rect(PAGE_W / 2 - 28, namY + 4, 56, 1.2, "F");

  if (!whiteLabel) {
    setFont(9); setColor(C.muted);
    doc.text("Soluciones Tecnológicas Empresariales", PAGE_W / 2, namY + 12, { align: "center" });
  }

  // Main title block
  setFont(20, "bold"); setColor(C.text);
  doc.text("Cotización Comercial", PAGE_W / 2, namY + 32, { align: "center" });

  // Quote number badge
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE_W / 2 - 33, namY + 37, 66, 11, 2, 2, "FD");
  setFont(8); setColor(C.muted);
  doc.text(qNum, PAGE_W / 2, namY + 44, { align: "center" });

  // Info cards (client + details)
  const cY = 195;
  const cardW = (PAGE_W - M * 2 - 5) / 2;

  // Left card — client
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.roundedRect(M, cY, cardW, 35, 2.5, 2.5, "FD");
  setFont(7, "bold"); setColor(C.green);
  doc.text("PREPARADO PARA", M + 7, cY + 10);
  setFont(12, "bold"); setColor(C.dark);
  const clientLines = doc.splitTextToSize(clientName, cardW - 14);
  doc.text(clientLines, M + 7, cY + 18);

  // Right card — meta
  const rx2 = M + cardW + 5;
  doc.setFillColor(...C.bg);
  doc.setDrawColor(...C.border);
  doc.roundedRect(rx2, cY, cardW, 35, 2.5, 2.5, "FD");
  setFont(7, "bold"); setColor(C.green);
  doc.text("DETALLES", rx2 + 7, cY + 10);
  setFont(9); setColor(C.text);
  doc.text(`Fecha de emisión: ${date}`, rx2 + 7, cY + 18);
  doc.text(`Válida por: ${validityDays} días hábiles`, rx2 + 7, cY + 26);

  // Bottom green bar
  doc.setFillColor(...C.green);
  doc.rect(0, PAGE_H - 19, PAGE_W, 19, "F");
  if (!whiteLabel) {
    setFont(8); setColor(C.white);
    doc.text(
      "ventas@bartez.com.ar  ·  www.bartez.com.ar",
      PAGE_W / 2, PAGE_H - 7, { align: "center" }
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // PAGE 2 — CONTENT
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawHeader();

  // ── Product table ────────────────────────────────────────────────────
  const head = [[
    "Producto",
    "Cant.",
    ...(showCost ? ["Costo"] : []),
    "Precio s/IVA",
    "IVA",
    "Total c/IVA",
  ]];

  const body = products.map((p) => [
    p.name,
    String(p.quantity),
    ...(showCost ? [fmt(p.cost ?? 0, currency)] : []),
    fmt(p.price, currency),
    `${p.ivaRate ?? 21}%`,
    fmt(p.totalWithIVA ?? p.total, currency),
  ]);

  // Column widths: total content = 180mm
  const colStyles = showCost
    ? {
        0: { cellWidth: 52, fontStyle: "bold" as const },
        1: { cellWidth: 12, halign: "center" as const },
        2: { cellWidth: 26, halign: "right" as const },
        3: { cellWidth: 30, halign: "right" as const },
        4: { cellWidth: 16, halign: "center" as const },
        5: { cellWidth: 34, halign: "right" as const },
      }
    : {
        0: { cellWidth: 72, fontStyle: "bold" as const },
        1: { cellWidth: 12, halign: "center" as const },
        2: { cellWidth: 34, halign: "right" as const },
        3: { cellWidth: 16, halign: "center" as const },
        4: { cellWidth: 46, halign: "right" as const },
      };

  autoTable(doc, {
    startY: M + 28,
    head,
    body,
    margin: { left: M, right: M },
    styles: {
      fontSize: 9,
      cellPadding: { top: 4.5, bottom: 4.5, left: 5, right: 5 },
      lineColor: C.border,
      lineWidth: 0.2,
      textColor: C.text,
    },
    headStyles: {
      fillColor: C.dark,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 5.5, bottom: 5.5, left: 5, right: 5 },
    },
    alternateRowStyles: { fillColor: C.bg },
    bodyStyles: { fillColor: C.white },
    columnStyles: colStyles,
    tableLineColor: C.border,
    tableLineWidth: 0.2,
    showHead: "everyPage",
    didDrawPage: (data) => {
      // Re-draw header on continuation pages (autoTable page 2+)
      if (data.pageNumber > 1) drawHeader();
    },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? M + 28 + 20) + 10;

  // Ensure enough space for post-table content (~115mm needed)
  if (y > PAGE_H - 120) {
    doc.addPage();
    drawHeader();
    y = M + 32;
  }

  // ── Total block ──────────────────────────────────────────────────────
  const tbW = 88;
  const tbX = PAGE_W - M - tbW;

  if (iva) {
    doc.setFillColor(...C.bg);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(tbX, y, tbW, 26, 2.5, 2.5, "FD");

    setFont(8.5); setColor(C.muted);
    doc.text("Subtotal s/IVA", tbX + 8, y + 9);
    doc.text("IVA", tbX + 8, y + 18);
    setFont(8.5, "bold"); setColor(C.text);
    doc.text(fmt(subtotal, currency), tbX + tbW - 7, y + 9, { align: "right" });
    doc.text(fmt(ivaAmt, currency), tbX + tbW - 7, y + 18, { align: "right" });
    y += 29;
  }

  // Grand total — dark pill
  doc.setFillColor(...C.dark);
  doc.roundedRect(tbX, y, tbW, 17, 2.5, 2.5, "F");
  setFont(8); setColor([160, 160, 160] as any);
  doc.text("TOTAL", tbX + 8, y + 7);
  setFont(13, "bold"); setColor(C.white);
  doc.text(fmt(grandTotal, currency), tbX + tbW - 7, y + 12.5, { align: "right" });

  y += 26;

  // ── Commercial conditions ────────────────────────────────────────────
  const condW = (PAGE_W - M * 2 - 6) / 3;
  const condH = 27;
  const conditions = [
    { label: "Validez",       value: `${validityDays} días hábiles` },
    { label: "Forma de pago", value: paymentTerms },
    { label: "Entrega",       value: deliveryTerms },
  ];

  conditions.forEach((cond, i) => {
    const cx = M + i * (condW + 3);
    doc.setFillColor(...C.greenLight);
    doc.setDrawColor(...C.greenBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, condW, condH, 2, 2, "FD");
    setFont(7, "bold"); setColor(C.green);
    doc.text(cond.label.toUpperCase(), cx + 5, y + 9);
    setFont(8.5); setColor(C.text);
    const lines = doc.splitTextToSize(cond.value, condW - 10);
    doc.text(lines, cx + 5, y + 17);
  });

  y += condH + 14;

  // ── Signature block + QR ─────────────────────────────────────────────
  const sigX = M;
  const sigW = 68;

  if (opts.signatureImageBase64) {
    try {
      doc.addImage(opts.signatureImageBase64, "PNG", sigX, y, sigW * 0.55, 14);
    } catch { /* skip */ }
    y += 16;
  }

  hLine(y + 16, sigX, sigX + sigW, C.borderDark, 0.5);
  setFont(8, "bold"); setColor(C.dark);
  doc.text(brandName, sigX, y + 22);
  setFont(7.5); setColor(C.muted);
  doc.text("Área Comercial", sigX, y + 29);

  // QR code — bottom right
  if (qrData && !whiteLabel) {
    const qrSize = 24;
    const qrX = PAGE_W - M - qrSize;
    try {
      doc.addImage(qrData, "PNG", qrX, y + 2, qrSize, qrSize);
      setFont(6.5); setColor(C.muted);
      doc.text("Visitá nuestro sitio", qrX + qrSize / 2, y + qrSize + 6, { align: "center" });
    } catch { /* skip */ }
  }

  y += 40;

  // ── Thank-you line ───────────────────────────────────────────────────
  if (!whiteLabel) {
    setFont(9, "italic"); setColor(C.muted);
    doc.text("Gracias por confiar en Bartez Tecnología", PAGE_W / 2, y, { align: "center" });
  }

  // ── Draw footers on all content pages ────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  const contentPages = totalPages - 1; // page 1 is cover
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i - 1, contentPages);
  }

  // ── Save ─────────────────────────────────────────────────────────────
  doc.save(`cotizacion_${clientName.replace(/\s+/g, "_")}_${qNum}.pdf`);
}
