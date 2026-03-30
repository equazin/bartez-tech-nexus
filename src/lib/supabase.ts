import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const isPlaceholderUrl = !supabaseUrl || supabaseUrl.includes("tu-proyecto.supabase.co");
const isPlaceholderKey = !supabaseAnonKey || supabaseAnonKey === "tu-anon-key-aqui";

export const isSupabaseConfigured = !isPlaceholderUrl && !isPlaceholderKey;

if (!isSupabaseConfigured) {
  console.warn(
    "[Bartez] Supabase no configurado. Defini VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env"
  );
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder"
);

export type UserRole = "client" | "cliente" | "admin" | "vendedor";
export type ClientType = "mayorista" | "reseller" | "empresa";

export const CLIENT_TYPE_MARGINS: Record<ClientType, number> = {
  mayorista: 10,
  reseller: 20,
  empresa: 15,
};

export interface UserProfile {
  id: string;
  company_name: string;
  contact_name: string;
  default_margin: number;
  client_type: ClientType;
  role: UserRole;
  credit_limit?: number;
  credit_used?: number;
  payment_terms?: number;
  active?: boolean;
}

