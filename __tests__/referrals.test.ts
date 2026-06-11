import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { generateInviteCode, getReferralRateBps, normalizeInviteCode } from "@/lib/referrals";

vi.mock("@/lib/admin-auth", () => ({
  requireAdminUser: () => Promise.resolve({ id: "admin-1", email: "admin@example.com" }),
  adminJson: (body: unknown, init?: ResponseInit) => NextResponse.json(body, init),
}));

vi.mock("@/lib/auth-d1", () => ({
  getAuthD1: () => ({
    prepare: () => ({
      bind: () => ({
        first: () => Promise.resolve({ id: "user-1", email: "u@example.com" }),
        run: () => Promise.resolve({ success: true }),
      }),
    }),
  }),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users/user-1/operation-note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("referral helpers", () => {
  it("normalizes invite codes and generates compact uppercase codes", () => {
    expect(normalizeInviteCode(" ab12 ")).toBe("AB12");
    expect(generateInviteCode()).toMatch(/^[A-Z0-9]{8}$/);
  });

  it("maps active direct counts to the configured two-level rates", () => {
    expect(getReferralRateBps(100, 1)).toEqual({ tier: "level1", rateBps: 2500 });
    expect(getReferralRateBps(50, 2)).toEqual({ tier: "level2", rateBps: 500 });
    expect(getReferralRateBps(10, 1)).toEqual({ tier: "level3", rateBps: 1000 });
    expect(getReferralRateBps(9, 2)).toEqual({ tier: "level4", rateBps: 100 });
  });
});

describe("operation note withdrawal removal", () => {
  it("rejects withdrawal_note", async () => {
    const { POST } = await import("@/app/api/admin/users/[id]/operation-note/route");
    const res = await POST(
      makeRequest({ kind: "withdrawal_note", amount: 100, channel: "manual", reason: "test" }),
      { params: Promise.resolve({ id: "user-1" }) }
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("refund_note");
  });
});
