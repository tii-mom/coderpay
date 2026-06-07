import { NextRequest, NextResponse } from "next/server";
import { readSessionEmail } from "./lib/session";

export async function middleware(req: NextRequest) {
  const sessionEmail = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (sessionEmail) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/console", "/console/:path*"]
};
