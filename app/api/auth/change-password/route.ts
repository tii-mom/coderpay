export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { verifyPassword, hashPassword } from "@/lib/password";
import { getAuthD1 } from "@/lib/auth-d1";

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
    await getAuthD1()
      .prepare(`UPDATE User SET passwordHash = ?, updatedAt = ? WHERE id = ?`)
      .bind(newHash, new Date().toISOString(), user.id)
      .run();

    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("Change password failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
