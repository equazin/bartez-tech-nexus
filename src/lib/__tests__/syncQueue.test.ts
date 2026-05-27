import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
// fake-indexeddb auto-installs the IDB globals on import.
import "fake-indexeddb/auto";

import {
  drainQueue,
  enqueueAction,
  listActions,
  registerSyncHandler,
  removeAction,
} from "@/lib/syncQueue";

async function resetDb() {
  // Delete the IDB database to start fresh.
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("bartez_sync_queue");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

beforeAll(async () => {
  await resetDb();
});

beforeEach(async () => {
  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

describe("syncQueue.enqueueAction", () => {
  it("persists actions in FIFO order", async () => {
    await enqueueAction("place_order", { id: "a" });
    await enqueueAction("save_quote", { id: "b" });
    const actions = await listActions();
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe("place_order");
    expect(actions[1].type).toBe("save_quote");
  });

  it("assigns unique IDs and timestamps", async () => {
    const a = await enqueueAction("place_order", { id: "x" });
    const b = await enqueueAction("place_order", { id: "y" });
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBeLessThanOrEqual(b.createdAt);
  });
});

describe("syncQueue.removeAction", () => {
  it("removes a specific entry", async () => {
    const a = await enqueueAction("place_order", { id: 1 });
    await enqueueAction("save_quote", { id: 2 });
    await removeAction(a.id);
    const remaining = await listActions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("save_quote");
  });
});

describe("syncQueue.drainQueue", () => {
  it("processes registered handlers and removes succeeded actions", async () => {
    const processed: unknown[] = [];
    registerSyncHandler("place_order", async (payload) => {
      processed.push(payload);
    });

    await enqueueAction("place_order", { id: 10 });
    await enqueueAction("place_order", { id: 11 });

    const result = await drainQueue();
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(processed).toEqual([{ id: 10 }, { id: 11 }]);
    expect(await listActions()).toHaveLength(0);
  });

  it("increments retries on handler failure", async () => {
    let calls = 0;
    registerSyncHandler("save_quote", async () => {
      calls += 1;
      throw new Error("boom");
    });

    await enqueueAction("save_quote", { id: "fail" });
    const result = await drainQueue();
    expect(calls).toBe(1);
    expect(result.failed).toBe(1);
    const remaining = await listActions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].retries).toBe(1);
    expect(remaining[0].lastError).toBe("boom");
  });

  it("drops actions after MAX_RETRIES failures", async () => {
    registerSyncHandler("save_quote", async () => {
      throw new Error("nope");
    });

    await enqueueAction("save_quote", { id: "doomed" });

    // 5 drains should hit MAX_RETRIES = 5 and remove the action.
    for (let i = 0; i < 5; i += 1) {
      await drainQueue();
    }
    expect(await listActions()).toHaveLength(0);
  });

  it("returns zero counts when nothing is queued", async () => {
    const result = await drainQueue();
    expect(result).toEqual({ succeeded: 0, failed: 0, remaining: 0 });
  });
});
