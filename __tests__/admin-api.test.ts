import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ----- State variables for mocks -----

let mockSessionEmail: string | null = null;
let mockAdminEmails = "";
let targetUserBalance = 100;
let targetUserPackage = "free";
let targetUserSubscriptionExpiresAt: string | null = null;
let targetUserAdminNote: string | null = "test note";
let rechargeStatus = "pending";

// ----- Mocks -----

vi.mock("@/lib/session", () => ({
  readSessionEmail: () => Promise.resolve(mockSessionEmail),
}));

vi.mock("@/lib/d1-binding", () => ({
  resolveD1: () => null,
  resolveEnvVar: (name: string) => {
    if (name === "ADMIN_EMAILS") return mockAdminEmails;
    if (name === "SESSION_SECRET") return "test-secret-at-least-32-characters-long!!";
    if (name === "PLATFORM_RECHARGE_USER_EMAIL") return "platform@example.com";
    return "";
  },
}));

function filterBySqlFields(obj: any, sql: string) {
  if (!obj) return obj;
  const match = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
  if (!match) return obj;
  const selectClause = match[1];
  if (selectClause.includes("*")) return obj;
  
  // Extract field names, removing aliases and table prefixes
  const fields = selectClause.split(",").map(f => {
    const trimmed = f.trim().replace(/\s+/g, ' ');
    const aliasMatch = trimmed.match(/as\s+(\w+)/i);
    if (aliasMatch) return aliasMatch[1];
    const dotParts = trimmed.split(".");
    return dotParts[dotParts.length - 1];
  });
  
  const filtered: any = {};
  for (const key of Object.keys(obj)) {
    if (fields.includes(key)) {
      filtered[key] = obj[key];
    }
  }
  return filtered;
}

// Dynamic Mock D1 implementation
const mockFirst = vi.fn().mockImplementation(async function(this: any) {
  const sql = this?.sql || "";
  let result: any = null;

  // Summary endpoint uses "... AS v" aggregate aliases.
  if (/\bAS v\b/.test(sql)) {
    return { v: 0 };
  }
  // Platform status uses "... AS c" count aliases.
  if (/\bAS c\b/.test(sql)) {
    return { c: 0 };
  }
  // Platform status: most-recent heartbeat lookup.
  if (sql.includes("ORDER BY lastHeartbeat DESC")) {
    return { lastHeartbeat: null };
  }
  // Platform recharge user lookup by lowercased email.
  if (sql.includes("LOWER(email) =")) {
    return { id: "platform-1", email: "platform@example.com" };
  }

  // 1. Admin lookup by email
  if (sql.includes("FROM User WHERE email =")) {
    if (mockSessionEmail === "admin@example.com") {
      result = { id: "admin-1", email: "admin@example.com" };
    }
  }
  // RechargeOrder lookup for manual-confirm
  else if (sql.includes("FROM RechargeOrder WHERE id =")) {
    result = {
      id: "RC96251105",
      userId: "target-1",
      amountCents: 10000,
      realAmountCents: 10000,
      payType: "wechat",
      status: rechargeStatus,
    };
  }
  // 2. Count users
  else if (sql.includes("SELECT COUNT(*)")) {
    return { total: 1 };
  }
  // 3. User lookup by ID (both admin check and target user queries)
  else if (sql.includes("FROM User WHERE id =")) {
    // If it's a query for the admin user specifically
    if (this?.params && this.params[0] === "admin-1") {
      result = { id: "admin-1", email: "admin@example.com" };
    } else {
      // Default to returning the target user
      result = {
        id: "target-1",
        email: "target@example.com",
        feeBalance: targetUserBalance,
        packageType: targetUserPackage,
        subscriptionExpiresAt: targetUserSubscriptionExpiresAt,
        subscriptionStartedAt: null,
        freeOrderUsed: 5,
        createdAt: "2026-01-01T00:00:00.000Z",
        adminNote: targetUserAdminNote,
        passwordHash: "SHOULD_NOT_APPEAR",
        emailVerifyTokenHash: "SHOULD_NOT_APPEAR",
        passwordResetTokenHash: "SHOULD_NOT_APPEAR",
      };
    }
  }

  return filterBySqlFields(result, sql);
});

const mockAll = vi.fn().mockImplementation(async function(this: any) {
  const sql = this?.sql || "";
  if (sql.includes("FROM User ORDER BY")) {
    const raw = {
      id: "target-1",
      email: "target@example.com",
      feeBalance: targetUserBalance,
      packageType: targetUserPackage,
      subscriptionExpiresAt: targetUserSubscriptionExpiresAt,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    return {
      results: [filterBySqlFields(raw, sql)]
    };
  }
  return { results: [] };
});

const mockRun = vi.fn().mockResolvedValue({ success: true });

const mockPrepare = vi.fn((sql: string) => {
  const context = {
    sql,
    params: [] as any[],
    bind: function(...args: any[]) {
      this.params = args;
      return this;
    },
    first: async function() {
      return mockFirst.call(this);
    },
    all: async function() {
      return mockAll.call(this);
    },
    run: async function() {
      return mockRun.call(this);
    }
  };
  return context;
});

const mockBatch = vi.fn(() => Promise.resolve([]));

vi.mock("@/lib/auth-d1", () => ({
  getAuthD1: () => ({
    prepare: mockPrepare,
    batch: mockBatch,
  }),
  runAuthAtomic: async (_db: unknown, statements: Array<{ run: () => Promise<unknown> }>) => {
    const results = [];
    for (const stmt of statements) {
      results.push(await stmt.run());
    }
    return results;
  },
}));

// ----- Helpers -----

function makeRequest(url: string, method = "GET", body?: unknown) {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init as any);
}

// ----- Tests -----

describe("Admin API — Auth Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = null;
    mockAdminEmails = "admin@example.com";
  });

  it("GET /api/admin/users returns 401 for unauthenticated user", async () => {
    mockSessionEmail = null;
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(makeRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("GET /api/admin/users returns 403 for non-admin user", async () => {
    mockSessionEmail = "user@example.com";
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(makeRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("GET /api/admin/users succeeds for admin user", async () => {
    mockSessionEmail = "admin@example.com";
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(makeRequest("http://localhost/api/admin/users"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("users");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("total");
  });
});

describe("Admin API — adjust-balance validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
    targetUserBalance = 100;
  });

  it("returns 400 when reason is empty", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-balance/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-balance",
        "POST",
        { delta: 10, reason: "" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when delta is not a number", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-balance/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-balance",
        "POST",
        { delta: "abc", reason: "test" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when result balance would be negative", async () => {
    targetUserBalance = 5;
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-balance/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-balance",
        "POST",
        { delta: -10, reason: "deduct" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("Admin API — adjust-subscription validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
    targetUserPackage = "free";
    targetUserBalance = 100;
    targetUserSubscriptionExpiresAt = null;
  });

  it("returns 400 for invalid packageType", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-subscription/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-subscription",
        "POST",
        { packageType: "enterprise", reason: "test" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when pro plan has no future expiry", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-subscription/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-subscription",
        "POST",
        {
          packageType: "pro",
          subscriptionExpiresAt: null,
          reason: "test",
        }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("Admin API — user detail security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
    targetUserBalance = 50;
    targetUserPackage = "pro";
    targetUserSubscriptionExpiresAt = "2026-12-31T00:00:00.000Z";
  });

  it("GET /api/admin/users/[id] does not return sensitive fields", async () => {
    const { GET } = await import("@/app/api/admin/users/[id]/route");
    const res = await GET(
      makeRequest("http://localhost/api/admin/users/target-1"),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    // User object should NOT contain sensitive fields
    expect(data.user).not.toHaveProperty("passwordHash");
    expect(data.user).not.toHaveProperty("emailVerifyTokenHash");
    expect(data.user).not.toHaveProperty("passwordResetTokenHash");

    // Should contain safe fields
    expect(data.user.email).toBe("target@example.com");
    expect(data.user.feeBalance).toBe(50);
  });
});

describe("Admin API — confirmEmail enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
    targetUserBalance = 100;
    targetUserPackage = "pro";
    targetUserSubscriptionExpiresAt = "2026-12-31T00:00:00.000Z";
  });

  it("balance deduction returns 400 when confirmEmail does not match", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-balance/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-balance",
        "POST",
        { delta: -10, reason: "deduct", confirmEmail: "wrong@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("balance deduction succeeds when confirmEmail matches", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-balance/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-balance",
        "POST",
        { delta: -10, reason: "deduct", confirmEmail: "target@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("subscription downgrade to free returns 400 when confirmEmail does not match", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-subscription/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-subscription",
        "POST",
        { packageType: "free", reason: "downgrade", confirmEmail: "wrong@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("subscription downgrade to free succeeds when confirmEmail matches", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/adjust-subscription/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/adjust-subscription",
        "POST",
        { packageType: "free", reason: "downgrade", confirmEmail: "target@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(200);
  });
});

describe("Admin API — reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
  });

  it("returns 400 when confirmEmail does not match", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/reset-password/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/reset-password",
        "POST",
        { newPassword: "newpass123", reason: "forgot", confirmEmail: "wrong@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is empty", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/reset-password/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/reset-password",
        "POST",
        { newPassword: "   ", reason: "forgot", confirmEmail: "target@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("succeeds and never returns a password hash", async () => {
    const { POST } = await import(
      "@/app/api/admin/users/[id]/reset-password/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/users/target-1/reset-password",
        "POST",
        { newPassword: "newpass123", reason: "forgot", confirmEmail: "target@example.com" }
      ),
      { params: Promise.resolve({ id: "target-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("success");
    expect(JSON.stringify(data)).not.toContain("pbkdf2");
    expect(data).not.toHaveProperty("passwordHash");
    expect(data).not.toHaveProperty("newPassword");
    // a write to AdminAuditLog must have occurred
    const auditWrite = mockPrepare.mock.calls.some(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("AdminAuditLog")
    );
    expect(auditWrite).toBe(true);
  });
});

describe("Admin API — summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
  });

  it("returns 401 for unauthenticated user", async () => {
    mockSessionEmail = null;
    const { GET } = await import("@/app/api/admin/summary/route");
    const res = await GET(makeRequest("http://localhost/api/admin/summary"));
    expect(res.status).toBe(401);
  });

  it("returns summary metrics for admin", async () => {
    const { GET } = await import("@/app/api/admin/summary/route");
    const res = await GET(makeRequest("http://localhost/api/admin/summary"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalUsers");
    expect(data).toHaveProperty("todayNewUsers");
    expect(data).toHaveProperty("todaySuccessOrderAmount");
    expect(data).toHaveProperty("todayFeeIncome");
    expect(data).toHaveProperty("onlineDevices");
    expect(data).toHaveProperty("webhookFailed");
    // noindex header present
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });
});

describe("Admin API — platform-recharge-status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
  });

  it("returns 403 for non-admin", async () => {
    mockSessionEmail = "user@example.com";
    const { GET } = await import("@/app/api/admin/platform-recharge-status/route");
    const res = await GET(makeRequest("http://localhost/api/admin/platform-recharge-status"));
    expect(res.status).toBe(403);
  });

  it("returns readiness payload for admin", async () => {
    const { GET } = await import("@/app/api/admin/platform-recharge-status/route");
    const res = await GET(makeRequest("http://localhost/api/admin/platform-recharge-status"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("ready");
    expect(data).toHaveProperty("configured");
    expect(data).toHaveProperty("hasWechat");
    expect(data).toHaveProperty("hasAlipay");
    expect(data).toHaveProperty("gaps");
  });
});

describe("Admin API — recharge manual-confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionEmail = "admin@example.com";
    mockAdminEmails = "admin@example.com";
    targetUserBalance = 100;
    targetUserPackage = "free";
    targetUserSubscriptionExpiresAt = null;
    rechargeStatus = "pending";
  });

  it("returns 403 for non-admin", async () => {
    mockSessionEmail = "user@example.com";
    const { POST } = await import(
      "@/app/api/admin/recharge-orders/[id]/manual-confirm/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/recharge-orders/RC96251105/manual-confirm",
        "POST",
        { confirmEmail: "target@example.com" }
      ),
      { params: Promise.resolve({ id: "RC96251105" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when confirmEmail does not match target user", async () => {
    const { POST } = await import(
      "@/app/api/admin/recharge-orders/[id]/manual-confirm/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/recharge-orders/RC96251105/manual-confirm",
        "POST",
        { confirmEmail: "wrong@example.com" }
      ),
      { params: Promise.resolve({ id: "RC96251105" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 when recharge already succeeded (no double credit)", async () => {
    rechargeStatus = "success";
    const { POST } = await import(
      "@/app/api/admin/recharge-orders/[id]/manual-confirm/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/recharge-orders/RC96251105/manual-confirm",
        "POST",
        { confirmEmail: "target@example.com" }
      ),
      { params: Promise.resolve({ id: "RC96251105" }) }
    );
    expect(res.status).toBe(409);
  });

  it("credits balance and writes audit log when confirmEmail matches", async () => {
    const { POST } = await import(
      "@/app/api/admin/recharge-orders/[id]/manual-confirm/route"
    );
    const res = await POST(
      makeRequest(
        "http://localhost/api/admin/recharge-orders/RC96251105/manual-confirm",
        "POST",
        { confirmEmail: "target@example.com", reason: "补入账" }
      ),
      { params: Promise.resolve({ id: "RC96251105" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("success");
    // 100 + 100.00 (10000 cents) = 200
    expect(data.feeBalance).toBe(200);
    const auditWrite = mockPrepare.mock.calls.some(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("AdminAuditLog")
    );
    expect(auditWrite).toBe(true);
    const claimWrite = mockPrepare.mock.calls.some(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("UPDATE RechargeOrder SET status = 'success'")
    );
    expect(claimWrite).toBe(true);
  });
});
