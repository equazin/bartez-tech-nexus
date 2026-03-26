import { useState, useCallback } from "react";
import { Quote, QuoteStatus } from "@/models/quote";

const STORAGE_KEY = (userId: string) => `b2b_quotes_${userId}`;

function loadQuotes(userId: string): Quote[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) || "[]");
  } catch {
    return [];
  }
}

function saveQuotes(userId: string, quotes: Quote[]) {
  localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(quotes));
}

function nextId(quotes: Quote[]): number {
  return quotes.length > 0 ? Math.max(...quotes.map((q) => q.id)) + 1 : 1;
}

export function useQuotes(userId: string) {
  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes(userId));

  const persist = useCallback(
    (updated: Quote[]) => {
      setQuotes(updated);
      saveQuotes(userId, updated);
    },
    [userId]
  );

  const addQuote = useCallback(
    (data: Omit<Quote, "id">): Quote => {
      const existing = loadQuotes(userId);
      const quote: Quote = { ...data, id: nextId(existing) };
      persist([quote, ...existing]);
      return quote;
    },
    [userId, persist]
  );

  const updateQuote = useCallback(
    (id: number, changes: Partial<Quote>) => {
      const existing = loadQuotes(userId);
      const updated = existing.map((q) =>
        q.id === id
          ? { ...q, ...changes, updated_at: new Date().toISOString() }
          : q
      );
      persist(updated);
    },
    [userId, persist]
  );

  const updateStatus = useCallback(
    (id: number, status: QuoteStatus) => updateQuote(id, { status }),
    [updateQuote]
  );

  const deleteQuote = useCallback(
    (id: number) => {
      const existing = loadQuotes(userId);
      persist(existing.filter((q) => q.id !== id));
    },
    [userId, persist]
  );

  const getQuotes = useCallback(() => loadQuotes(userId), [userId]);

  /** Create a copy of an existing quote with incremented version */
  const duplicateQuote = useCallback(
    (id: number): Quote | null => {
      const existing = loadQuotes(userId);
      const original = existing.find((q) => q.id === id);
      if (!original) return null;
      const now = new Date().toISOString();
      const copy: Quote = {
        ...original,
        id: nextId(existing),
        status: "draft",
        version: (original.version ?? 1) + 1,
        parent_id: original.parent_id ?? original.id,
        order_id: undefined,
        created_at: now,
        updated_at: now,
      };
      persist([copy, ...existing]);
      return copy;
    },
    [userId, persist]
  );

  /**
   * Mark a quote as converted to an order and link the order id.
   * Does NOT create the order — that's done by the caller via addOrder.
   */
  const linkOrderToQuote = useCallback(
    (quoteId: number, orderId: string | number) => {
      updateQuote(quoteId, { status: "approved", order_id: orderId });
    },
    [updateQuote]
  );

  return {
    quotes,
    addQuote,
    updateQuote,
    updateStatus,
    deleteQuote,
    getQuotes,
    duplicateQuote,
    linkOrderToQuote,
  };
}
