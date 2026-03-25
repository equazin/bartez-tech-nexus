import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Bartez] Supabase no configurado. Definí VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

export type UserRole = "client" | "admin";

export interface UserProfile {
  id: string;
  company_name: string;
  contact_name: string;
  default_margin: number;
  role: UserRole;
}
