import { NextRequest, NextResponse } from "next/server";
import { readSessionEmail } from "./lib/session";

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/pay/checkout") {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/pay/") && req.nextUrl.pathname !== "/pay/checkout") {
    const orderId = req.nextUrl.pathname.split("/").filter(Boolean)[1];
    if (orderId) {
      const checkoutUrl = new URL("/pay/checkout", req.url);
      checkoutUrl.searchParams.set("id", orderId);
      return NextResponse.redirect(checkoutUrl);
    }
  }

  const sessionEmail = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (sessionEmail) {
    if (req.nextUrl.pathname.startsWith("/console/")) {
      const consoleUrl = new URL("/console", req.url);
      consoleUrl.search = req.nextUrl.search;
      return NextResponse.rewrite(consoleUrl);
    }
    const res = NextResponse.next();
    // The admin panel must never be indexed by search engines.
    if (req.nextUrl.pathname.startsWith("/admin")) {
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return res;
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  const res = NextResponse.redirect(loginUrl);
  if (req.nextUrl.pathname.startsWith("/admin")) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  matcher: ["/console", "/console/:path*", "/admin", "/admin/:path*", "/pay/:path*"]
};
