import { describe, expect, it } from "vitest";
import { isRateLimited, enforceRateLimit } from "@/lib/rate-limit";

function makeReq(ip: string) {
  return { headers: { get: (h: string) => (h === "x-forwarded-for" ? ip : null) } } as any;
}

describe("isRateLimited", () => {
  it("allows up to the limit then blocks within the window", () => {
    const ns = "test:basic";
    const key = "1.1.1.1";
    const now = 1_000;
    // limit 3: first 3 allowed, 4th blocked
    expect(isRateLimited(ns, key, 3, 60_000, now)).toBe(false);
    expect(isRateLimited(ns, key, 3, 60_000, now)).toBe(false);
    expect(isRateLimited(ns, key, 3, 60_000, now)).toBe(false);
    expect(isRateLimited(ns, key, 3, 60_000, now)).toBe(true);
  });

  it("resets after the window elapses", () => {
    const ns = "test:reset";
    const key = "2.2.2.2";
    expect(isRateLimited(ns, key, 1, 1_000, 0)).toBe(false);
    expect(isRateLimited(ns, key, 1, 1_000, 0)).toBe(true);
    // window passed
    expect(isRateLimited(ns, key, 1, 1_000, 2_000)).toBe(false);
  });

  it("isolates counts across namespaces and keys", () => {
    expect(isRateLimited("ns-a", "k", 1, 1_000, 0)).toBe(false);
    expect(isRateLimited("ns-b", "k", 1, 1_000, 0)).toBe(false); // different namespace
    expect(isRateLimited("ns-a", "other", 1, 1_000, 0)).toBe(false); // different key
  });
});

describe("enforceRateLimit", () => {
  it("returns null until the limit is exceeded, then a 429", () => {
    const req = makeReq("9.9.9.9");
    const opts = { name: "test:enforce", limit: 2, windowMs: 60_000 };
    expect(enforceRateLimit(req, opts)).toBeNull();
    expect(enforceRateLimit(req, opts)).toBeNull();
    const blocked = enforceRateLimit(req, opts);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBe("60");
  });
});
