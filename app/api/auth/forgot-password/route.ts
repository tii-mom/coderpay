export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addMinutes, createRawToken, hashAuthToken } from "@/lib/auth-tokens";
import { assertEmailConfigured, buildPasswordResetEmail, sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    assertEmailConfigured();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const token = createRawToken();
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: await hashAuthToken(token),
          passwordResetExpiresAt: addMinutes(new Date(), 30),
        },
      });
      const emailContent = buildPasswordResetEmail(updated.email, token);
      await sendEmail({ to: updated.email, ...emailContent });
    }

    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("Password reset email failed:", err);
    const status = typeof (err as any)?.status === "number" ? (err as any).status : 500;
    const error = status === 503 ? "Email service is not configured" : "Internal server error";
    return NextResponse.json({ error }, { status });
  }
}
