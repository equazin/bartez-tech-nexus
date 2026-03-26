import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

// ── Colors ────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const GREEN:   RGB = [45, 159, 106];
const DARK:    RGB = [22, 22, 22];
const TEXT:    RGB = [38, 38, 38];
const MUTED:   RGB = [120, 120, 120];
const SUBTLE:  RGB = [170, 170, 170];
const BORDER:  RGB = [210, 210, 210];
const BORDER2: RGB = [180, 180, 180];
const BG:      RGB = [248, 248, 248];
const WHITE:   RGB = [255, 255, 255];

const PAGE_W = 210;
const PAGE_H = 297;
const M      = 14;   // left / right margin
const CW     = PAGE_W - M * 2; // content width = 182mm

// ── Public interface ──────────────────────────────────────────────────────
export interface QuotePDFOptions {
  clientName:   string;
  companyName:  string;
  clientEmail?: string;
  logoUrl?:     string;
  logoBase64?:  string;
  products: Array<{
    name:          string;
    quantity:      number;
    /** Unit price sin IVA */
    price:         number;
    /** Subtotal sin IVA (price × qty) */
    total:         number;
    ivaRate?:      number;
    ivaAmount?:    number;
    totalWithIVA?: number;
    cost?:         number;
  }>;
  total:         number;
  subtotal?:     number;
  ivaTotal?:     number;
  date:          string;
  showCost:      boolean;
  currency?:     "USD" | "ARS";
  whiteLabel?:   boolean;
  qrUrl?:        string;
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDays?: number;
  iva?:          boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function quoteNum(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `COT-${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}-${1000 + Math.floor(Math.random() * 9000)}`;
}

function fmt(v: number, cur: "USD" | "ARS"): string {
  return cur === "ARS"
    ? "$ " + Math.round(v).toLocaleString("es-AR")
    : "USD " + Math.round(v).toLocaleString("en-US");
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res  = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((ok) => {
      const r = new FileReader();
      r.onload  = () => ok(r.result as string);
      r.onerror = () => ok(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function makeQR(url: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(url, { width: 120, margin: 1, color: { dark: "#161616", light: "#ffffff" } });
  } catch { return null; }
}

// ── Main ──────────────────────────────────────────────────────────────────
export async function generateQuotePDF(opts: QuotePDFOptions) {
  const {
    clientName, companyName, products, date, showCost,
    currency    = "USD",
    whiteLabel  = false,
    qrUrl       = "https://www.bartez.com.ar",
    validityDays = 7,
    paymentTerms  = "Transferencia bancaria / efectivo",
    deliveryTerms = "A coordinar con el área comercial",
    iva           = false,
    clientEmail,
  } = opts;

  const qn        = quoteNum();
  const brand     = whiteLabel ? clientName : companyName;
  const subtotal  = opts.subtotal ?? products.reduce((s, p) => s + p.total, 0);
  const ivaAmt    = iva ? (opts.ivaTotal ?? products.reduce((s, p) => s + (p.ivaAmount ?? 0), 0)) : 0;
  const total     = opts.total;

  const [logo, qr] = await Promise.all([
    opts.logoBase64 ? Promise.resolve(opts.logoBase64)
      : opts.logoUrl ? toDataUrl(opts.logoUrl)
      : toDataUrl("/icon.png"),
    !whiteLabel ? makeQR(qrUrl) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── tiny helpers ─────────────────────────────────────────────────────────
  const sf = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFontSize(size); doc.setFont("helvetica", style);
  };
  const sc = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const hl = (y: number, x1 = M, x2 = PAGE_W - M, c: RGB = BORDER, lw = 0.3) => {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(lw); doc.line(x1, y, x2, y);
  };
  const img = (d: string, x: number, y: number, w: number, h: number) => {
    try { doc.addImage(d, "PNG", x, y, w, h); } catch { /* skip */ }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════════════════════
  let y = M;

  // Logo (18×18mm)
  const logoSize = 18;
  if (logo) img(logo, M, y, logoSize, logoSize);
  const lx = logo ? M + logoSize + 4 : M;   // text starts after logo

  // Company name + subtitle
  sf(12, "bold"); sc(DARK);
  doc.text(brand, lx, y + 6);
  if (!whiteLabel) {
    sf(7.5); sc(MUTED);
    doc.text("Soluciones Tecnológicas Empresariales", lx, y + 12);
  }

  // Quote number + date (right-aligned)
  const rx = PAGE_W - M;
  sf(8.5, "bold"); sc(DARK);
  doc.text(`Cotización ${qn}`, rx, y + 6, { align: "right" });
  sf(8); sc(MUTED);
  doc.text(`Fecha: ${date}`, rx, y + 12, { align: "right" });

  y += Math.max(logoSize, 14) + 4;   // ~36

  // ── separator ────────────────────────────────────────────────────────────
  hl(y, M, PAGE_W - M, BORDER2, 0.4);
  y += 7;

  // ══════════════════════════════════════════════════════════════════════════
  // TITLE BLOCK
  // ══════════════════════════════════════════════════════════════════════════
  sf(14, "bold"); sc(DARK);
  doc.text("COTIZACIÓN COMERCIAL", PAGE_W / 2, y, { align: "center" });
  y += 6;
  sf(8, "italic"); sc(MUTED);
  doc.text("Propuesta tecnológica personalizada", PAGE_W / 2, y, { align: "center" });
  y += 8;

  hl(y, M, PAGE_W - M, BORDER, 0.3);
  y += 7;

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENT INFO
  // ══════════════════════════════════════════════════════════════════════════
  sf(8.5); sc(TEXT);
  doc.text(`Cliente:  ${clientName}`, M, y);
  y += 5.5;
  if (clientEmail) {
    doc.text(`Email:    ${clientEmail}`, M, y);
    y += 5.5;
  }
  doc.text(`Validez:  ${validityDays} días hábiles`, M, y);
  y += 7;

  hl(y, M, PAGE_W - M, BORDER, 0.3);
  y += 6;

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCT TABLE
  // ══════════════════════════════════════════════════════════════════════════
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

  // Column widths sum = CW = 182mm
  const colStyles = showCost
    ? { 0: { cellWidth: 50, fontStyle: "bold" as const },
        1: { cellWidth: 12, halign: "center" as const },
        2: { cellWidth: 24, halign: "right"  as const },
        3: { cellWidth: 30, halign: "right"  as const },
        4: { cellWidth: 14, halign: "center" as const },
        5: { cellWidth: 42, halign: "right"  as const } }
    : { 0: { cellWidth: 74, fontStyle: "bold" as const },
        1: { cellWidth: 12, halign: "center" as const },
        2: { cellWidth: 32, halign: "right"  as const },
        3: { cellWidth: 14, halign: "center" as const },
        4: { cellWidth: 50, halign: "right"  as const } };

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: M, right: M },
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: BORDER,
      lineWidth: 0.2,
      textColor: TEXT,
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: BG },
    bodyStyles: { fillColor: WHITE },
    columnStyles: colStyles,
    tableLineColor: BORDER,
    tableLineWidth: 0.2,
    showHead: "everyPage",
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        // minimal header on continuation pages
        if (logo) img(logo, M, M, logoSize, logoSize);
        sf(10, "bold"); sc(DARK); doc.text(brand, lx, M + 6);
        sf(7.5); sc(MUTED);
        doc.text(`${qn}  ·  ${date}`, PAGE_W - M, M + 6, { align: "right" });
        hl(M + logoSize + 2, M, PAGE_W - M, BORDER2, 0.3);
      }
    },
  });

  y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 6;

  // page-break safety before post-table content (~65mm needed)
  if (y > PAGE_H - 75) {
    doc.addPage();
    if (logo) img(logo, M, M, logoSize, logoSize);
    sf(10, "bold"); sc(DARK); doc.text(brand, lx, M + 6);
    hl(M + logoSize + 2, M, PAGE_W - M, BORDER2, 0.3);
    y = M + logoSize + 8;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOTALS  (right-aligned block)
  // ══════════════════════════════════════════════════════════════════════════
  const labelX  = PAGE_W - M - 70;
  const valueX  = PAGE_W - M;
  const rowH    = 5.5;

  if (iva) {
    sf(8.5); sc(MUTED);
    doc.text("Subtotal:", labelX, y);
    doc.text(fmt(subtotal, currency), valueX, y, { align: "right" });
    y += rowH;

    doc.text("IVA:", labelX, y);
    sc(TEXT);
    doc.text(fmt(ivaAmt, currency), valueX, y, { align: "right" });
    y += rowH + 1;
  }

  // Line above TOTAL FINAL
  hl(y, labelX - 2, PAGE_W - M, BORDER2, 0.35);
  y += 5;

  sf(10, "bold"); sc(DARK);
  doc.text("TOTAL FINAL:", labelX, y);
  doc.text(fmt(total, currency), valueX, y, { align: "right" });
  y += 10;

  // ══════════════════════════════════════════════════════════════════════════
  // CONDITIONS
  // ══════════════════════════════════════════════════════════════════════════
  hl(y, M, PAGE_W - M, BORDER, 0.3);
  y += 6;

  sf(8.5, "bold"); sc(TEXT);
  doc.text("Condiciones comerciales:", M, y);
  y += 5.5;

  sf(8.5); sc(TEXT);
  const conds = [
    `Validez de la cotización: ${validityDays} días hábiles`,
    `Forma de pago: ${paymentTerms}`,
    `Entrega: ${deliveryTerms}`,
  ];
  conds.forEach((line) => {
    doc.text(`• ${line}`, M + 2, y);
    y += 5.2;
  });
  y += 3;

  // ══════════════════════════════════════════════════════════════════════════
  // THANK-YOU + FOOTER
  // ══════════════════════════════════════════════════════════════════════════
  hl(y, M, PAGE_W - M, BORDER, 0.3);
  y += 7;

  if (!whiteLabel) {
    sf(9, "italic"); sc(MUTED);
    doc.text(`Gracias por confiar en ${brand}`, PAGE_W / 2, y, { align: "center" });
    y += 10;
  }

  // Footer: company info left, QR right
  sf(8); sc(TEXT);
  if (!whiteLabel) {
    doc.text(brand,                    M, y);
    sf(7.5); sc(MUTED);
    doc.text("ventas@bartez.com.ar",   M, y + 5);
    doc.text("www.bartez.com.ar",      M, y + 10);
  }

  if (qr && !whiteLabel) {
    const qrS = 22;
    const qrX = PAGE_W - M - qrS;
    img(qr, qrX, y - 2, qrS, qrS);
    sf(6.5); sc(SUBTLE);
    doc.text("Visitá nuestro sitio", qrX + qrS / 2, y + qrS + 1, { align: "center" });
  }

  // ── page numbers on every page ───────────────────────────────────────────
  const total_pages = doc.getNumberOfPages();
  if (total_pages > 1) {
    for (let i = 1; i <= total_pages; i++) {
      doc.setPage(i);
      sf(7); sc(SUBTLE);
      doc.text(`Página ${i} de ${total_pages}`, PAGE_W - M, PAGE_H - M, { align: "right" });
    }
  }

  doc.save(`cotizacion_${clientName.replace(/\s+/g, "_")}_${qn}.pdf`);
}
