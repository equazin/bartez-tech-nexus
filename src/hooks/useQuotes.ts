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

  return { quotes, addQuote, updateQuote, updateStatus, deleteQuote, getQuotes };
}
