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

export type UserRole = "client" | "cliente" | "admin" | "vendedor" | "sales";
export type ClientType = "mayorista" | "reseller" | "empresa";

export const CLIENT_TYPE_MARGINS: Record<ClientType, number> = {
  mayorista: 10,
  reseller: 20,
  empresa: 15,
};

export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  company_name: string;
  contact_name: string;
  default_margin: number;
  client_type: ClientType;
  role: UserRole;
  active?: boolean;
  // Credit (migration 002)
  credit_limit?: number;
  credit_used?: number;
  payment_terms?: number;
  // CRM fields (migration 016)
  estado?: "activo" | "inactivo" | "bloqueado";
  precio_lista?: "standard" | "mayorista" | "distribuidor" | "especial";
  razon_social?: string;
  cuit?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  notas_internas?: string;
  vendedor_id?: string;
  // Corporate hierarchy (migration 031)
  parent_id?: string;
  b2b_role?: "manager" | "buyer" | "admin";
  approval_threshold?: number;
  // Partner level + assigned seller (migration 069)
  partner_level?: "cliente" | "silver" | "gold" | "platinum";
  assigned_seller_id?: string;
  monthly_target?: number;
  // Client 360 persistence (migration 073)
  last_contact_at?: string;
  last_contact_type?: "nota" | "llamada" | "reunion" | "seguimiento" | "alerta" | "pedido" | "cotizacion" | "ticket";
}
