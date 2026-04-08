import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Hook to synchronize the local cart state with Supabase for authenticated users.
 * Uses debouncing to prevent excessive database writes.
 */
export function useCartSync(cart: Record<number, number>, setCart: (cart: Record<number, number>) => void) {
  const { user } = useAuth();
  const hasHydrated = useRef(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const latestCart = useRef(cart);
  const latestUserId = useRef<string | null>(user?.id ?? null);
  const hasPendingSync = useRef(false);

  const syncRemoteCart = useCallback(async (userId: string, items: Record<number, number>) => {
    const { error } = await supabase
      .from("carts")
      .upsert({
        user_id: userId,
        items,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
    hasPendingSync.current = false;
  }, []);

  useEffect(() => {
    latestCart.current = cart;
  }, [cart]);

  useEffect(() => {
    latestUserId.current = user?.id ?? null;
  }, [user?.id]);

  // 1. Initial Load: Fetch cart from Supabase when user logs in
  useEffect(() => {
    if (!user) {
      hasHydrated.current = true;
      hasPendingSync.current = false;
      return;
    }

    async function loadRemoteCart() {
      try {
        const { data, error } = await supabase
          .from("carts")
          .select("items")
          .eq("user_id", user?.id)
          .single();

        if (error && error.code !== "PGRST116") throw error; // PGRST116 is "no rows found"

        if (data?.items) {
          setCart(data.items as Record<number, number>);
        } else if (Object.keys(latestCart.current).length > 0) {
          hasPendingSync.current = true;
          await syncRemoteCart(user.id, latestCart.current);
        }
      } catch (err) {
        console.error("Error loading remote cart:", err);
      } finally {
        hasHydrated.current = true;
      }
    }

    hasHydrated.current = false;
    void loadRemoteCart();
  }, [user, setCart, syncRemoteCart]);

  // 2. Sync Loop: Update Supabase when local cart changes
  useEffect(() => {
    if (!user) return;
    if (!hasHydrated.current) {
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    hasPendingSync.current = true;

    debounceTimer.current = setTimeout(async () => {
      try {
        await syncRemoteCart(user.id, cart);
      } catch (err) {
        console.error("Error syncing cart to Supabase:", err);
      }
    }, 2000); // 2 second debounce

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [cart, user, syncRemoteCart]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      const userId = latestUserId.current;
      if (!userId || !hasPendingSync.current) {
        return;
      }

      void syncRemoteCart(userId, latestCart.current).catch((err) => {
        console.error("Error flushing cart sync on unmount:", err);
      });
    };
  }, [syncRemoteCart]);
}
