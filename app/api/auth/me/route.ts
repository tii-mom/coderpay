export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ isLoggedIn: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      isLoggedIn: true,
      id: user.id,
      email: user.email,
      feeBalance: user.feeBalance,
      packageType: user.packageType,
      freeOrderUsed: user.freeOrderUsed,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      firstProDiscountUsed: user.firstProDiscountUsed,
      firstMaxDiscountUsed: user.firstMaxDiscountUsed,
    });
  } catch (err) {
    console.error("API request failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
