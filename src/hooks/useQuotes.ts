import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Quote, QuoteStatus } from "@/models/quote";

// ── One-time localStorage → Supabase migration ──────────────────────────────
async function migrateLocalStorageQuotes(userId: string): Promise<void> {
  const key = `b2b_quotes_${userId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return;
  try {
    const local: Quote[] = JSON.parse(raw);
    if (!local.length) return;
    const rows = local.map((q) => ({
      client_id:   userId,
      client_name: q.client_name,
      items:       q.items,
      subtotal:    q.subtotal,
      iva_total:   q.ivaTotal,
      total:       q.total,
      currency:    q.currency,
      status:      q.status,
      version:     q.version  ?? 1,
      parent_id:   null,
      created_at:  q.created_at,
      updated_at:  q.updated_at,
    }));
    const { error } = await supabase.from("quotes").insert(rows);
    if (!error) {
      localStorage.removeItem(key);
    }
  } catch {
    // Silencioso — no bloquear si falla la migración
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useQuotes(userId: string) {
  const [quotes, setQuotes]   = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchQuotes = useCallback(async () => {
    if (!userId || userId === "guest") return;
    setLoading(true);
    try {
      // Migrate legacy localStorage quotes on first load
      await migrateLocalStorageQuotes(userId);

      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("client_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Map DB snake_case → frontend camelCase
        setQuotes(data.map(dbToQuote));
      }
    } catch {
      // Silencioso — tabla puede no existir todavía
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // ── addQuote ───────────────────────────────────────────────────────────────
  const addQuote = useCallback(
    async (data: Omit<Quote, "id">): Promise<Quote | null> => {
      if (!userId || userId === "guest") return null;
      try {
        const { data: inserted, error } = await supabase
          .from("quotes")
          .insert(quoteToDb(data, userId))
          .select("*")
          .single();
        if (error || !inserted) return null;
        const quote = dbToQuote(inserted as Record<string, unknown>);
        setQuotes((prev) => [quote, ...prev]);
        return quote;
      } catch {
        return null;
      }
    },
    [userId]
  );

  // ── updateQuote ────────────────────────────────────────────────────────────
  const updateQuote = useCallback(
    async (id: number | string, changes: Partial<Quote>): Promise<void> => {
      try {
        const patch: Record<string, unknown> = {};
        if (changes.client_name !== undefined) patch.client_name = changes.client_name;
        if (changes.items       !== undefined) patch.items       = changes.items;
        if (changes.subtotal    !== undefined) patch.subtotal    = changes.subtotal;
        if (changes.ivaTotal    !== undefined) patch.iva_total   = changes.ivaTotal;
        if (changes.total       !== undefined) patch.total       = changes.total;
        if (changes.currency    !== undefined) patch.currency    = changes.currency;
        if (changes.status      !== undefined) patch.status      = changes.status;
        if (changes.version     !== undefined) patch.version     = changes.version;
        if (changes.parent_id   !== undefined) patch.parent_id   = changes.parent_id;
        if (changes.order_id    !== undefined) patch.order_id    = changes.order_id;
        if (changes.valid_days  !== undefined) patch.valid_days  = changes.valid_days;
        if (changes.expires_at  !== undefined) patch.expires_at  = changes.expires_at;
        if (changes.notes       !== undefined) patch.notes       = changes.notes;

        const { data: updatedRow, error } = await supabase
          .from("quotes")
          .update(patch)
          .eq("id", id)
          .select("*")
          .single();
        if (error || !updatedRow) return;
        const updated = dbToQuote(updatedRow as Record<string, unknown>);
        setQuotes((prev) => prev.map((q) => (String(q.id) === String(id) ? updated : q)));
      } catch {
        // Silencioso
      }
    },
    []
  );

  // ── updateStatus ───────────────────────────────────────────────────────────
  const updateStatus = useCallback(
    (id: number | string, status: QuoteStatus) => updateQuote(id, { status }),
    [updateQuote]
  );

  // ── deleteQuote ────────────────────────────────────────────────────────────
  const deleteQuote = useCallback(
    async (id: number | string): Promise<void> => {
      try {
        const { error } = await supabase.from("quotes").delete().eq("id", id);
        if (!error) {
          setQuotes((prev) => prev.filter((q) => String(q.id) !== String(id)));
        }
      } catch {
        // Silencioso
      }
    },
    []
  );

  // ── getQuotes (synchronous snapshot for backward compat) ───────────────────
  const getQuotes = useCallback(() => quotes, [quotes]);

  // ── duplicateQuote ─────────────────────────────────────────────────────────
  const duplicateQuote = useCallback(
    async (id: number): Promise<Quote | null> => {
      const original = quotes.find((q) => String(q.id) === String(id));
      if (!original || !userId || userId === "guest") return null;
      const now = new Date().toISOString();
      return addQuote({
        ...original,
        status:    "draft",
        version:   (original.version ?? 1) + 1,
        parent_id: original.parent_id ?? original.id,
        order_id:  undefined,
        created_at: now,
        updated_at: now,
      });
    },
    [quotes, userId, addQuote]
  );

  // ── linkOrderToQuote ───────────────────────────────────────────────────────
  const linkOrderToQuote = useCallback(
    (quoteId: number, orderId: string | number) =>
      updateQuote(quoteId, { status: "approved", order_id: orderId }),
    [updateQuote]
  );

  return {
    quotes,
    loading,
    addQuote,
    updateQuote,
    updateStatus,
    deleteQuote,
    getQuotes,
    duplicateQuote,
    linkOrderToQuote,
    refetch: fetchQuotes,
  };
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function dbToQuote(row: Record<string, unknown>): Quote {
  return {
    id:          Number(row.id ?? 0),
    client_id:   row.client_id as string,
    client_name: (row.client_name as string) ?? "",
    items:       (row.items as Quote["items"]) ?? [],
    subtotal:    Number(row.subtotal ?? 0),
    ivaTotal:    Number(row.iva_total ?? 0),
    total:       Number(row.total ?? 0),
    currency:    (row.currency as "USD" | "ARS") ?? "USD",
    status:      (row.status as QuoteStatus) ?? "draft",
    version:     (row.version as number) ?? 1,
    parent_id:   row.parent_id as number | undefined,
    order_id:    row.order_id as string | number | undefined,
    valid_days:  row.valid_days as number | undefined,
    expires_at:  row.expires_at as string | undefined,
    notes:       row.notes as string | undefined,
    created_at:  row.created_at as string,
    updated_at:  row.updated_at as string,
  };
}

function quoteToDb(q: Omit<Quote, "id">, userId: string): Record<string, unknown> {
  return {
    client_id:   userId,
    client_name: q.client_name,
    items:       q.items,
    subtotal:    q.subtotal,
    iva_total:   q.ivaTotal,
    total:       q.total,
    currency:    q.currency,
    status:      q.status,
    version:     q.version  ?? 1,
    parent_id:   q.parent_id ?? null,
    order_id:    q.order_id  ?? null,
    valid_days:  q.valid_days ?? null,
    expires_at:  q.expires_at ?? null,
    notes:       q.notes ?? null,
    created_at:  q.created_at,
    updated_at:  q.updated_at,
  };
}
