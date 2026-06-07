export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ status: "success", message: "Logged out successfully" });
  response.cookies.delete("session_email");
  if (req.nextUrl.hostname.endsWith("3api.shop")) {
    response.cookies.set("session_email", "", {
      path: "/",
      domain: ".3api.shop",
      maxAge: 0
    });
  }
  return response;
}
