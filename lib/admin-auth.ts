import { NextRequest, NextResponse } from "next/server";
import { readSessionEmail } from "./session";
import { getAuthD1 } from "./auth-d1";
import { resolveEnvVar } from "./d1-binding";

export type AdminUser = {
  id: string;
  email: string;
};

/**
 * Build a JSON response that is never indexed by search engines.
 * All admin API routes should use this so the noindex header is consistent.
 */
export function adminJson(body: unknown, init?: { status?: number }): NextResponse {
  const res = NextResponse.json(body as Record<string, unknown>, init);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

/**
 * Parse ADMIN_EMAILS environment variable into a list of lowercase, trimmed emails.
 */
export function getAdminEmails(): string[] {
  const raw = resolveEnvVar("ADMIN_EMAILS");
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if the current request comes from an authenticated admin user.
 * Returns the admin user object or null.
 */
export async function getAdminUser(req: NextRequest): Promise<AdminUser | null> {
  const sessionEmail = await readSessionEmail(
    req.cookies.get("session_email")?.value
  );
  if (!sessionEmail) return null;

  const normalizedEmail = sessionEmail.trim().toLowerCase();
  const adminEmails = getAdminEmails();
  if (!adminEmails.includes(normalizedEmail)) return null;

  const user = await getAuthD1()
    .prepare(`SELECT id, email FROM User WHERE email = ? LIMIT 1`)
    .bind(sessionEmail)
    .first<{ id: string; email: string }>();

  if (!user) return null;
  return { id: user.id, email: user.email };
}

/**
 * Require admin authentication. Returns the admin user or an error NextResponse.
 * API routes should check: if (result instanceof NextResponse) return result;
 */
export async function requireAdminUser(
  req: NextRequest
): Promise<AdminUser | NextResponse> {
  const sessionEmail = await readSessionEmail(
    req.cookies.get("session_email")?.value
  );
  if (!sessionEmail) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  const normalizedEmail = sessionEmail.trim().toLowerCase();
  const adminEmails = getAdminEmails();
  if (!adminEmails.includes(normalizedEmail)) {
    return adminJson({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getAuthD1()
    .prepare(`SELECT id, email FROM User WHERE email = ? LIMIT 1`)
    .bind(sessionEmail)
    .first<{ id: string; email: string }>();

  if (!user) {
    return adminJson({ error: "Unauthorized" }, { status: 401 });
  }

  return { id: user.id, email: user.email };
}
