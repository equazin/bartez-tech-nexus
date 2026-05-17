import { useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "bartez_form_draft__";
const DEFAULT_DEBOUNCE_MS = 2000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEnvelope<T> {
  version: number;
  savedAt: string;
  state: T;
}

export interface UseFormDraftOptions<T> {
  /** Stable key (e.g. `product-form:${productId ?? "new"}`). */
  key: string;
  /** Current form state. */
  state: T;
  /** Debounce before writing to storage. Default 2000ms. */
  debounceMs?: number;
  /** Schema version — bump when shape changes to invalidate stale drafts. */
  version?: number;
  /** If true, do not auto-restore on mount (caller will call `restore()`). */
  manualRestore?: boolean;
  /** Disable persistence entirely (e.g. after a successful save). */
  enabled?: boolean;
}

export interface UseFormDraftResult<T> {
  /** Restored draft on first read; null if no draft was found. */
  initialDraft: T | null;
  /** ISO timestamp of the saved draft currently in storage, if any. */
  savedAt: string | null;
  /** Manually restore the draft into the form state (caller decides what to do). */
  restore: () => T | null;
  /** Discard the persisted draft. */
  clear: () => void;
  /** Force an immediate save (bypasses debounce). */
  flush: () => void;
}

function readEnvelope<T>(storageKey: string, version: number): DraftEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || parsed.version !== version) return null;
    if (Date.now() - new Date(parsed.savedAt).getTime() > MAX_AGE_MS) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Auto-save a form state to localStorage with debounce.
 * Returns the initial draft (if any) so the form can hydrate from it.
 *
 * Usage:
 *   const { initialDraft, clear, savedAt } = useFormDraft({ key, state });
 *   useEffect(() => { if (initialDraft) setForm(initialDraft); }, [initialDraft]);
 *   // After successful submit:
 *   clear();
 */
export function useFormDraft<T>({
  key,
  state,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  version = 1,
  manualRestore = false,
  enabled = true,
}: UseFormDraftOptions<T>): UseFormDraftResult<T> {
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const [initialDraft, setInitialDraft] = useState<T | null>(() => {
    if (manualRestore) return null;
    const envelope = readEnvelope<T>(storageKey, version);
    return envelope?.state ?? null;
  });
  const [savedAt, setSavedAt] = useState<string | null>(() => {
    const envelope = readEnvelope<T>(storageKey, version);
    return envelope?.savedAt ?? null;
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (snapshot: T) => {
    if (typeof window === "undefined") return;
    try {
      const envelope: DraftEnvelope<T> = {
        version,
        savedAt: new Date().toISOString(),
        state: snapshot,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(envelope));
      setSavedAt(envelope.savedAt);
    } catch {
      // quota / SSR — ignore
    }
  };

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(state), debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, enabled, debounceMs, storageKey, version]);

  const restore = (): T | null => {
    const envelope = readEnvelope<T>(storageKey, version);
    if (envelope) {
      setInitialDraft(envelope.state);
      setSavedAt(envelope.savedAt);
      return envelope.state;
    }
    return null;
  };

  const clear = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setInitialDraft(null);
    setSavedAt(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const flush = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    persist(state);
  };

  return { initialDraft, savedAt, restore, clear, flush };
}
