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

/**
 * Returns a Supabase client with the service role key.
 * Use ONLY in server-side functions — never expose to the browser.
 * Bypasses RLS; has full DB access.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
