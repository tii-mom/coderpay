import { NextRequest, NextResponse } from "next/server";

// Best-effort in-memory rate limiter, keyed per namespace + client identifier.
//
// LIMITATION: on Cloudflare Pages Functions this state lives per isolate and is
// recycled, so it is NOT a strong distributed guarantee — it blunts naive floods
// that hit the same isolate. Pair it with a Cloudflare WAF rate-limiting rule for
// hard protection. Kept consistent with the mobile limiter in lib/mobile-auth.ts.

type Bucket = { count: number; resetAt: number };

const store = globalThis as unknown as {
  coderpayRateLimitNamespaces?: Map<string, Map<string, Bucket>>;
};
const namespaces = store.coderpayRateLimitNamespaces || new Map<string, Map<string, Bucket>>();
store.coderpayRateLimitNamespaces = namespaces;

function bucketsFor(namespace: string) {
  let buckets = namespaces.get(namespace);
  if (!buckets) {
    buckets = new Map<string, Bucket>();
    namespaces.set(namespace, buckets);
  }
  return buckets;
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Returns true when the caller has exceeded `limit` requests within `windowMs`.
 * The first request in a fresh window starts the counter.
 */
export function isRateLimited(
  namespace: string,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
) {
  const buckets = bucketsFor(namespace);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

/**
 * Convenience guard for route handlers: returns a 429 NextResponse when the
 * request is rate limited, otherwise null. Key defaults to the client IP.
 */
export function enforceRateLimit(
  req: NextRequest,
  options: { name: string; limit: number; windowMs: number; key?: string }
) {
  const key = options.key || clientIp(req);
  if (isRateLimited(options.name, key, options.limit, options.windowMs)) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(options.windowMs / 1000)) } }
    );
  }
  return null;
}
