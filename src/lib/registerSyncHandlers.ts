// Wires the sync queue to real backend calls. Imported once at portal bootstrap
// so queued offline actions can drain when the connection returns.

import { registerSyncHandler } from "@/lib/syncQueue";
import { createOrderFromCart, type CheckoutPayload } from "@/lib/api/checkoutApi";

let registered = false;

export function registerPortalSyncHandlers(): void {
  if (registered) return;
  registered = true;

  registerSyncHandler<CheckoutPayload>("place_order", async (payload) => {
    await createOrderFromCart(payload);
  });

  // save_quote handler can be added here when offline quote drafting is wired.
}
