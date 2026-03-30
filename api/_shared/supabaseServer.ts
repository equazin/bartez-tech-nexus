import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient(req: VercelRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars are missing");
  }

  const bearer = req.headers.authorization;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: bearer ? { Authorization: bearer } : {},
    },
  });
}
