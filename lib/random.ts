const HEX = "0123456789abcdef";

export function randomHex(bytesLength: number) {
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => HEX[byte >> 4] + HEX[byte & 0x0f]).join("");
}

export function randomNumericCode(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => String(byte % 10)).join("");
}
