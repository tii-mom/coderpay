import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/change-password/route";
import { NextRequest } from "next/server";
import { verifyPassword, hashPassword } from "@/lib/password";

const mockUser = {
  id: "user-1",
  email: "u@example.com",
  passwordHash: "pbkdf2-sha256:100000:c2FsdA==:aGFzaA==",
};

const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: (...args: any[]) => mockUpdate(...args),
    },
  },
}));

let mockSessionUser: any = null;
vi.mock("@/lib/auth", () => ({
  getSessionUser: () => mockSessionUser,
}));

describe("Change Password API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = null;
  });

  it("returns 401 if user is not logged in", async () => {
    mockSessionUser = null;
    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "old", newPassword: "new" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 if missing parameters or new password is empty", async () => {
    mockSessionUser = mockUser;
    
    // Test missing currentPassword
    let req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "new" }),
    });
    let res = await POST(req);
    expect(res.status).toBe(400);

    // Test empty newPassword
    req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "old", newPassword: "   " }),
    });
    res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("New password cannot be empty");
  });

  it("returns 400 if current password is incorrect", async () => {
    const correctOldPassword = "correctOldPassword";
    const realOldHash = await hashPassword(correctOldPassword);
    mockSessionUser = {
      ...mockUser,
      passwordHash: realOldHash,
    };

    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "wrongOldPassword", newPassword: "newPassword" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Incorrect current password");
  });

  it("updates password successfully and verifies new hash works while old hash fails", async () => {
    const correctOldPassword = "correctOldPassword";
    const realOldHash = await hashPassword(correctOldPassword);
    mockSessionUser = {
      ...mockUser,
      passwordHash: realOldHash,
    };

    let updatedHash = "";
    mockUpdate.mockImplementation(({ where, data }) => {
      expect(where.id).toBe(mockUser.id);
      updatedHash = data.passwordHash;
      return Promise.resolve({ ...mockSessionUser, passwordHash: updatedHash });
    });

    const newPassword = "superSecretNewPassword123";
    const req = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: correctOldPassword, newPassword }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("success");

    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Verify using verifyPassword logic
    const verifyNewPasswordSuccess = await verifyPassword(newPassword, updatedHash);
    expect(verifyNewPasswordSuccess).toBe(true);

    const verifyOldPasswordFailure = await verifyPassword(correctOldPassword, updatedHash);
    expect(verifyOldPasswordFailure).toBe(false);
  });
});
