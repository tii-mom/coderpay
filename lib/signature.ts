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
