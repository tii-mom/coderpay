import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const sessionEmail = req.cookies.get("session_email")?.value;
  if (sessionEmail) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/console", "/console/:path*"]
};
