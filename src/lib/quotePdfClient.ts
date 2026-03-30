import type { QuotePDFOptions } from "@/components/QuotePDF";

export async function generateQuotePdfOnDemand(options: QuotePDFOptions) {
  const { generateQuotePDF } = await import("@/components/QuotePDF");
  return generateQuotePDF(options);
}
