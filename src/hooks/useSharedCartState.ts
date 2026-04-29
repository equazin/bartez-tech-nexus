import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useCartSync } from "@/hooks/useCartSync";
import {
  hasCartItems,
  readStoredBundleCartMeta,
  readStoredCart,
  writeStoredBundleCartMeta,
  writeStoredCart,
  type BundleCartMetaMap,
  type CartQuantities,
} from "@/lib/cartStorage";

export interface SharedCartState {
  cart: CartQuantities;
  setCart: Dispatch<SetStateAction<CartQuantities>>;
  bundleCartMeta: BundleCartMetaMap;
  setBundleCartMeta: Dispatch<SetStateAction<BundleCartMetaMap>>;
}

export function useSharedCartState(userId: string): SharedCartState {
  const stableUserId = userId || "guest";
  const [cart, setCart] = useState<CartQuantities>(() => readStoredCart(stableUserId));
  const [bundleCartMeta, setBundleCartMeta] = useState<BundleCartMetaMap>(() =>
    readStoredBundleCartMeta(stableUserId),
  );

  useEffect(() => {
    setCart((current) => {
      const stored = readStoredCart(stableUserId);
      if (hasCartItems(stored)) return stored;
      if (hasCartItems(current)) {
        writeStoredCart(stableUserId, current);
        return current;
      }
      return {};
    });

    setBundleCartMeta((current) => {
      const stored = readStoredBundleCartMeta(stableUserId);
      if (Object.keys(stored).length > 0) return stored;
      if (Object.keys(current).length > 0) {
        writeStoredBundleCartMeta(stableUserId, current);
        return current;
      }
      return {};
    });
  }, [stableUserId]);

  useEffect(() => {
    writeStoredCart(stableUserId, cart);
  }, [cart, stableUserId]);

  useEffect(() => {
    writeStoredBundleCartMeta(stableUserId, bundleCartMeta);
  }, [bundleCartMeta, stableUserId]);

  useCartSync(cart, setCart);

  return { cart, setCart, bundleCartMeta, setBundleCartMeta };
}
