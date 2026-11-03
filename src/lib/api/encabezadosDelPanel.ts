import { supabase } from "@/lib/supabase";

/**
 * Encabezado de autorización con la sesión del panel. Los proxies de proveedores
 * (/api/air-proxy, /api/elit-proxy) devuelven costos mayoristas y
 * rechazan cualquier pedido sin una sesión de administrador, vendedor o sales.
 */
export async function encabezadosDelPanel(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}
