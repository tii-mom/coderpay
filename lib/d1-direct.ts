type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      first: <T = Record<string, unknown>>() => Promise<T | null>;
      all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
      run: () => Promise<unknown>;
    };
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
    run: () => Promise<unknown>;
  };
  batch?: (statements: Array<{ run: () => Promise<unknown> }>) => Promise<unknown>;
};

function runtimeRequire() {
  try {
    return Function("return typeof require === 'undefined' ? undefined : require")();
  } catch {
    return undefined;
  }
}

export function getDirectD1(): D1DatabaseLike {
  const env = process.env as any;
  if (env.DB) return env.DB as D1DatabaseLike;

  const req = runtimeRequire();
  if (req) {
    const { getRequestContext } = req("@cloudflare/next-on-pages");
    const db = getRequestContext().env.DB;
    if (db) return db as D1DatabaseLike;
  }

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
  if (signType !== "HMAC-SHA256") return false;
  const expected = await hmacSha256Hex(payload, appSecret);
  return expected.toLowerCase() === providedSign.toLowerCase();
}

export async function verifyDeviceSign(deviceCode: string, timestamp: string, deviceSecret: string, providedSign: string) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 10 * 60 * 1000) return false;
  const expected = await hmacSha256Hex(`${deviceCode}:${timestamp}`, deviceSecret);
  return expected.toLowerCase() === providedSign.toLowerCase();
}
