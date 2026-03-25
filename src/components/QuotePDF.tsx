import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface QuotePDFOptions {
  clientName: string;
  companyName: string;
  logoUrl?: string;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    margin: number;
    cost?: number;
  }>;
  total: number;
  date: string;
  showCost: boolean;
}

export function generateQuotePDF(options: QuotePDFOptions) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // LOGO / HEADER
  doc.setFontSize(18);
  doc.text(options.companyName, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(11);
  doc.text(`Cliente: ${options.clientName}`, 10, 35);
  doc.text(`Fecha: ${options.date}`, 10, 42);

  // TABLE HEADERS
  const head = [
    [
      "Producto",
      "Cantidad",
      ...(options.showCost ? ["Costo"] : []),
      "Margen %",
      "Precio",
      "Total",
    ],
  ];

  // TABLE BODY
  const body = options.products.map((p) => [
    p.name,
    p.quantity,
    ...(options.showCost ? [`$${(p.cost ?? 0).toLocaleString()}`] : []),
    `${p.margin}%`,
    `$${p.price.toLocaleString()}`,
    `$${p.total.toLocaleString()}`,
  ]);

  // TABLE
  autoTable(doc, {
    startY: 50,
    head,
    body,
    styles: {
      fontSize: 10,
    },
    headStyles: {
      fillColor: [255, 106, 0], // naranja Bartez
      textColor: [255, 255, 255],
    },
  });

  // 👉 FIX para TypeScript
  const finalY = (doc as any).lastAutoTable?.finalY || 60;

  // TOTAL
  doc.setFontSize(14);
  doc.text(
    `Total: $${options.total.toLocaleString()}`,
    pageWidth - 70,
    finalY + 15
  );

  // SAVE
  doc.save(`cotizacion_${options.clientName}_${options.date}.pdf`);
}