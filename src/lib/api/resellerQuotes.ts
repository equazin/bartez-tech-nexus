/**
 * Reseller Quote Generation Module
 * Allows B2B clients to generate quotes for their end-customers with custom markup and logo.
 */

export interface ResellerQuoteConfig {
  logoUrl?: string; // Client's logo to be displayed in the PDF
  markupPct: number; // Markup they apply to our prices (e.g. 20%)
  companyName?: string; // Their company name
  contactInfo?: string; // Their contact info (email/phone/address)
}

export interface QuoteItem {
  name: string;
  sku: string;
  bartezPrice: number; // Our price to the reseller (USD or ARS)
  resellerMarkupPrice: number; // BartezPrice * (1 + markupPct/100)
  quantity: number;
}

/**
 * Calculates the final price for the end-customer.
 */
export function calculateResellerPrice(bartezPrice: number, markupPct: number): number {
  return Number((bartezPrice * (1 + markupPct / 100)).toFixed(2));
}

/**
 * Persists the reseller's quote configuration to their profile.
 * See migration 057 (reseller_markup_config).
 */
import { supabase } from "@/lib/supabase";

export async function saveResellerConfig(clientId: string, config: ResellerQuoteConfig): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ reseller_markup_config: config })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
}

/**
 * Returns a PDF blob (Mock) for the reseller to share with their customer.
 * In production: this could call a microservice to render the PDF.
 */
export async function generateResellerQuotePdf(
  config: ResellerQuoteConfig,
  items: QuoteItem[],
  total: number
): Promise<Blob> {
  console.log(`[Reseller] Generating PDF for ${config.companyName} with markup: ${config.markupPct}%`);
  // Mock PDF Blob
  return new Blob(["Reseller Quote Content - Placeholder PDF"], { type: 'application/pdf' });
}
