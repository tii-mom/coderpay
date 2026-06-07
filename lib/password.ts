const ITERATIONS = 100_000;
const HASH_ALGORITHM = "SHA-256";

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array) {
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: HASH_ALGORITHM,
      salt: saltBuffer,
      iterations: ITERATIONS
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `pbkdf2-sha256:${ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterations, saltValue, hashValue] = storedHash.split(":");
  if (scheme !== "pbkdf2-sha256" || Number(iterations) !== ITERATIONS || !saltValue || !hashValue) {
    return false;
  }

  const salt = fromBase64(saltValue);
  const expected = fromBase64(hashValue);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
