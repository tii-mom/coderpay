import CryptoJS from "crypto-js";
import { resolveD1 } from "./d1-binding";

type D1RunResult = { success?: boolean; meta?: { changes?: number } };

type D1BoundStatement = {
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  run: () => Promise<D1RunResult>;
};

type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => D1BoundStatement;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
    run: () => Promise<D1RunResult>;
  };
  batch?: (statements: D1BoundStatement[]) => Promise<D1RunResult[]>;
};

/**
 * Commit several writes atomically. On real D1 this uses `batch()`, which runs
 * the statements in a single implicit transaction (all-or-nothing). When the
 * binding lacks `batch` (local fallback adapter), the statements run
 * sequentially as a best effort — acceptable because that path is dev-only.
 */
export async function runAtomic(db: D1DatabaseLike, statements: D1BoundStatement[]) {
  if (typeof db.batch === "function") {
    return db.batch(statements);
  }
  const results: D1RunResult[] = [];
  for (const stmt of statements) {
    results.push(await stmt.run());
  }
  return results;
}

export function getDirectD1(): D1DatabaseLike {
  const d1 = resolveD1();
  if (d1) return d1 as D1DatabaseLike;

  throw new Error("D1 binding is not available");
}

export function randomOrderId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = Array.from(bytes).reduce((acc, byte) => (acc * 256 + byte) % 1000000, 0);
  return `CP${String(num).padStart(6, "0")}`;
}

export function centsFromAmount(value: string | number) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Invalid amount");
  const [yuan, fraction = ""] = text.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Invalid amount");
  return cents;
}

export function amountFromCents(cents: number) {
  return Math.round(cents) / 100;
}

export function formatAmount(cents: number) {
  return amountFromCents(cents).toFixed(2);
}

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256Hex(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

export async function verifyMerchantSign(params: Record<string, unknown>, appSecret: string, signType: string, providedSign: string) {
  const query = Object.keys(params)
    .filter(key => key !== "sign")
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  const payload = `${query}&key=${appSecret}`;
  const expected = signType === "HMAC-SHA256"
    ? await hmacSha256Hex(payload, appSecret)
    : CryptoJS.MD5(payload).toString();
  return expected.toLowerCase() === providedSign.toLowerCase();
}

export async function verifyDeviceSign(deviceCode: string, timestamp: string, deviceSecret: string, providedSign: string) {
  const ts = Number(timestamp);
  // 2-minute window to limit replay; offline events are re-signed at send time.
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 2 * 60 * 1000) return false;
  const expected = await hmacSha256Hex(`${deviceCode}:${timestamp}`, deviceSecret);
  return expected.toLowerCase() === providedSign.toLowerCase();
}
