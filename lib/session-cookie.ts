import { NextRequest } from "next/server";

export function getSessionCookieOptions(req: NextRequest) {
  const hostname = req.nextUrl.hostname;
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isProductionHost = hostname.endsWith("3api.shop");
  const isHttps = req.nextUrl.protocol === "https:" || forwardedProto === "https";

  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProductionHost || isHttps,
    domain: isProductionHost ? ".3api.shop" : undefined,
    maxAge: 60 * 60 * 24 * 30,
  };
}
