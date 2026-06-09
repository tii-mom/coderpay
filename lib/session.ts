import { resolveEnvVar } from "./d1-binding";


function getSessionSecret() {
  const configured = resolveEnvVar("SESSION_SECRET") || resolveEnvVar("NEXTAUTH_SECRET");
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") {
    return "local-development-session-secret-change-before-production";
  }
  return "";
}

function toBase64Url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function sign(value: string) {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64Url(signature);
}

export async function createSessionToken(email: string) {
  const payload = toBase64Url(JSON.stringify({ email, iat: Date.now() }));
  return `${payload}.${await sign(payload)}`;
}

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches cookie maxAge

export async function readSessionEmail(token?: string) {
  if (!token || !token.includes(".")) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = await sign(payload);
    if (signature !== expected) return null;
    const parsed = JSON.parse(fromBase64Url(payload));
    if (typeof parsed.email !== "string") return null;
    // Reject tokens past their maximum lifetime even if the cookie outlives them.
    const iat = typeof parsed.iat === "number" ? parsed.iat : 0;
    if (!iat || Date.now() - iat > SESSION_MAX_AGE_MS) return null;
    return parsed.email;
  } catch {
    return null;
  }
}
