import { supabase } from "@/lib/supabase";
import type { ActivityLog, ActivityLogInsert } from "@/models/activityLog";

const TABLE = "activity_logs";

/** Fire-and-forget — never throws */
export function logActivity(input: ActivityLogInsert): void {
  supabase.from(TABLE).insert(input).then(() => {/* silencioso */});
}

export async function fetchActivityLogs(opts: {
  userId?: string;
  action?: string;
  limit?: number;
}): Promise<ActivityLog[]> {
  let query = supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.userId) query = query.eq("user_id", opts.userId);
  if (opts.action) query = query.eq("action", opts.action);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLog[];
}
