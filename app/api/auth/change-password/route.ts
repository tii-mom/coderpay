export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (newPassword.trim().length === 0) {
      return NextResponse.json({ error: "New password cannot be empty" }, { status: 400 });
    }

    // Verify current password
    const isCorrect = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCorrect) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    // Hash and update to database
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("Change password failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
