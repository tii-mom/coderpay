import { describe, expect, it, vi } from "vitest";
import { runAtomic } from "@/lib/d1-direct";

function boundStatement(label: string, sink: string[]) {
  return {
    first: async () => null,
    all: async () => ({ results: [] }),
    run: async () => {
      sink.push(label);
      return { success: true, meta: { changes: 1 } };
    },
  };
}

describe("runAtomic", () => {
  it("commits all statements through batch() in a single call when available", async () => {
    const ran: string[] = [];
    const batch = vi.fn(async (stmts: any[]) => {
      // batch must NOT invoke run() per statement; D1 runs them server-side.
      return stmts.map(() => ({ success: true, meta: { changes: 1 } }));
    });
    const db: any = { prepare: vi.fn(), batch };
    const a = boundStatement("a", ran);
    const b = boundStatement("b", ran);

    const result = await runAtomic(db, [a, b] as any);

    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0]).toHaveLength(2);
    expect(ran).toEqual([]); // batch path does not call run() locally
    expect(result).toHaveLength(2);
  });

  it("falls back to sequential run() when batch is unavailable", async () => {
    const ran: string[] = [];
    const db: any = { prepare: vi.fn() }; // no batch
    const a = boundStatement("a", ran);
    const b = boundStatement("b", ran);

    const result = await runAtomic(db, [a, b] as any);

    expect(ran).toEqual(["a", "b"]); // ran in order
    expect(result).toHaveLength(2);
  });

  it("propagates an error from the underlying batch (so caller can handle dup-hash)", async () => {
    const db: any = {
      prepare: vi.fn(),
      batch: vi.fn(async () => {
        throw new Error("UNIQUE constraint failed: PaymentEvent.notificationHash");
      }),
    };
    await expect(runAtomic(db, [] as any)).rejects.toThrow(/UNIQUE/);
  });
});
