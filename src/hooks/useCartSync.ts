import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Hook to synchronize the local cart state with Supabase for authenticated users.
 * Uses debouncing to prevent excessive database writes.
 */
export function useCartSync(cart: Record<number, number>, setCart: (cart: Record<number, number>) => void) {
  const { user } = useAuth();
  const isInitialMount = useRef(true);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Fetch cart from Supabase when user logs in
  useEffect(() => {
    if (!user) return;

    async function loadRemoteCart() {
      try {
        const { data, error } = await supabase
          .from("carts")
          .select("items")
          .eq("user_id", user?.id)
          .single();

        if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found"

        if (data?.items) {
          console.log("Cart loaded from Supabase:", data.items);
          setCart(data.items as Record<number, number>);
        }
      } catch (err) {
        console.error("Error loading remote cart:", err);
      }
    }

    loadRemoteCart();
  }, [user, setCart]);

  // 2. Sync Loop: Update Supabase when local cart changes
  useEffect(() => {
    if (!user) return;

    // Skip first run to avoid overwriting remote cart with empty local cart
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("carts")
          .upsert({
            user_id: user.id,
            items: cart,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
        console.log("Cart synced to Supabase");
      } catch (err) {
        console.error("Error syncing cart to Supabase:", err);
      }
    }, 2000); // 2 second debounce

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [cart, user]);
}
