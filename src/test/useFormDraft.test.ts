import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFormDraft } from "@/hooks/useFormDraft";

interface DemoState {
  name: string;
  qty: number;
}

const KEY = "demo-form";
const STORAGE_KEY = `bartez_form_draft__${KEY}`;

beforeEach(() => {
  localStorage.clear();
});

describe("useFormDraft", () => {
  it("returns no initial draft when storage is empty", () => {
    const { result } = renderHook(() =>
      useFormDraft<DemoState>({ key: KEY, state: { name: "", qty: 0 } }),
    );
    expect(result.current.initialDraft).toBeNull();
    expect(result.current.savedAt).toBeNull();
  });

  it("persists state after the debounce window and exposes savedAt", async () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: DemoState }) =>
        useFormDraft<DemoState>({ key: KEY, state, debounceMs: 10 }),
      { initialProps: { state: { name: "", qty: 0 } } },
    );

    rerender({ state: { name: "Bartez", qty: 5 } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.state).toEqual({ name: "Bartez", qty: 5 });
    expect(parsed.version).toBe(1);
    expect(result.current.savedAt).not.toBeNull();
  });

  it("hydrates initialDraft from storage on mount", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: { name: "From storage", qty: 9 },
      }),
    );
    const { result } = renderHook(() =>
      useFormDraft<DemoState>({ key: KEY, state: { name: "", qty: 0 } }),
    );
    expect(result.current.initialDraft).toEqual({ name: "From storage", qty: 9 });
  });

  it("ignores stored drafts with a mismatched version", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: { name: "Old", qty: 1 },
      }),
    );
    const { result } = renderHook(() =>
      useFormDraft<DemoState>({ key: KEY, state: { name: "", qty: 0 }, version: 2 }),
    );
    expect(result.current.initialDraft).toBeNull();
  });

  it("evicts drafts older than 7 days", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: eightDaysAgo,
        state: { name: "Stale", qty: 1 },
      }),
    );
    const { result } = renderHook(() =>
      useFormDraft<DemoState>({ key: KEY, state: { name: "", qty: 0 } }),
    );
    expect(result.current.initialDraft).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("respects manualRestore: does not hydrate but restore() returns the draft", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: { name: "Manual", qty: 3 },
      }),
    );
    const { result } = renderHook(() =>
      useFormDraft<DemoState>({ key: KEY, state: { name: "", qty: 0 }, manualRestore: true }),
    );
    expect(result.current.initialDraft).toBeNull();

    let restored: DemoState | null = null;
    act(() => {
      restored = result.current.restore();
    });
    expect(restored).toEqual({ name: "Manual", qty: 3 });
  });

  it("clear() wipes the stored draft", async () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: DemoState }) =>
        useFormDraft<DemoState>({ key: KEY, state, debounceMs: 10 }),
      { initialProps: { state: { name: "", qty: 0 } } },
    );

    rerender({ state: { name: "X", qty: 1 } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    act(() => result.current.clear());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.savedAt).toBeNull();
  });

  it("flush() bypasses the debounce", () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: DemoState }) =>
        useFormDraft<DemoState>({ key: KEY, state, debounceMs: 5000 }),
      { initialProps: { state: { name: "", qty: 0 } } },
    );
    rerender({ state: { name: "Flushed", qty: 2 } });
    act(() => result.current.flush());
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}").state).toEqual({ name: "Flushed", qty: 2 });
  });

  it("does not write when enabled=false", async () => {
    const { rerender } = renderHook(
      ({ state }: { state: DemoState }) =>
        useFormDraft<DemoState>({ key: KEY, state, debounceMs: 10, enabled: false }),
      { initialProps: { state: { name: "", qty: 0 } } },
    );
    rerender({ state: { name: "Should not save", qty: 7 } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
