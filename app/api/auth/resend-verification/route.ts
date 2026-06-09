export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { assertEmailConfigured, buildVerificationEmail, sendEmail } from "@/lib/email";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // Strict: each call sends an email. Throttle to prevent inbox bombing.
    const limited = enforceRateLimit(req, { name: "auth:resend-verification", limit: 5, windowMs: 300_000 });
    if (limited) return limited;

    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    assertEmailConfigured();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return NextResponse.json({ status: "success" });
    if (user.emailVerifiedAt) return NextResponse.json({ status: "success", verified: true });

    const token = createRawToken();
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyTokenHash: await hashAuthToken(token),
        emailVerifyExpiresAt: addMinutes(new Date(), 24 * 60),
      },
    });
    const emailContent = buildVerificationEmail(updated.email, token);
    await sendEmail({ to: updated.email, ...emailContent });
    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("Verification resend failed:", err);
    const status = typeof (err as any)?.status === "number" ? (err as any).status : 500;
    const error = status === 503 ? "Email service is not configured" : "Internal server error";
    return NextResponse.json({ error }, { status });
  }
}
