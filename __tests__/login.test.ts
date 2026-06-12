import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/password";

const mockFirst = vi.fn();
const mockRun = vi.fn();

vi.mock("@/lib/auth-d1", () => ({
  getAuthD1: () => ({
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: mockFirst,
        run: mockRun,
      })),
    })),
  }),
}));

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("Login API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects legacy placeholder password hashes instead of upgrading them", async () => {
    mockFirst.mockResolvedValue({
      id: "user-legacy",
      email: "legacy@example.com",
      passwordHash: "password_hash",
      emailVerifiedAt: new Date(),
      feeBalance: 0,
    });

    const res = await POST(request({ email: "legacy@example.com", password: "anything" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Invalid password" });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("accepts a valid PBKDF2 password", async () => {
    mockFirst.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      passwordHash: await hashPassword("correct-password"),
      emailVerifiedAt: new Date(),
      feeBalance: 12.34,
    });

    const res = await POST(request({ email: "user@example.com", password: "correct-password" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("success");
    expect(json.user.email).toBe("user@example.com");
    expect(res.cookies.get("session_email")?.value).toBeTruthy();
  });
});
