import { useCallback } from "react";
import { logActivity } from "@/lib/api/activityLog";
import type { ActivityAction } from "@/models/activityLog";

export function useActivityLog(userId: string | undefined) {
  const log = useCallback(
    (
      action: ActivityAction,
      opts?: {
        entity_type?: "product" | "order" | "quote";
        entity_id?: string | number;
        metadata?: Record<string, unknown>;
      }
    ) => {
      if (!userId) return;
      logActivity({
        user_id: userId,
        action,
        entity_type: opts?.entity_type,
        entity_id: opts?.entity_id != null ? String(opts.entity_id) : undefined,
        metadata: opts?.metadata,
      });
    },
    [userId]
  );

  return { log };
}
