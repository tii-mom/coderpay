import CryptoJS from "crypto-js";

export function verifySignature(params: Record<string, any>, appSecret: string, signType: string, providedSign: string): boolean {
  // Sort keys and exclude sign parameter
  const sortedKeys = Object.keys(params).filter(k => k !== "sign").sort();
  const queryStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
  
  const stringToSign = queryStr + `&key=${appSecret}`;
  
  let calculatedSign = "";
  if (signType === "HMAC-SHA256") {
    calculatedSign = CryptoJS.HmacSHA256(stringToSign, appSecret).toString();
  } else {
    // Classic MD5 hashing
    calculatedSign = CryptoJS.MD5(stringToSign).toString();
  }
  
  return calculatedSign.toLowerCase() === providedSign.toLowerCase();
}

export function deviceSignaturePayload(parts: Array<string | number | boolean | null | undefined>) {
  return parts.map(part => {
    if (part === true) return "1";
    if (part === false) return "0";
    return String(part ?? "");
  }).join(":");
}

export function verifyDeviceSignature(deviceCode: string, timestamp: string, deviceSecret: string, providedSign: string, payload?: string): boolean {
  const ts = Number(timestamp);
  // 2-minute window: tolerates clock drift while limiting signature replay.
  // Offline events are re-signed with the send-time timestamp, so this is safe
  // for delayed uploads.
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 2 * 60 * 1000) {
    return false;
  }

  const legacyMessage = `${deviceCode}:${timestamp}`;
  const signedMessages = payload ? [`${legacyMessage}:${payload}`, legacyMessage] : [legacyMessage];
  return signedMessages.some(message =>
    CryptoJS.HmacSHA256(message, deviceSecret).toString().toLowerCase() === providedSign.toLowerCase()
  );
}
