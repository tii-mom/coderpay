import { describe, expect, it, vi, afterEach } from "vitest";
import { createSessionToken, readSessionEmail } from "@/lib/session";

const SECRET = "test-session-secret-at-least-32-characters-long";

describe("session token lifetime", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("accepts a freshly issued token", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await createSessionToken("user@example.com");
    await expect(readSessionEmail(token)).resolves.toBe("user@example.com");
  });

  it("rejects a token older than the maximum lifetime", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await createSessionToken("user@example.com");
    // Advance 31 days, past the 30-day max age.
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    await expect(readSessionEmail(token)).resolves.toBeNull();
  });

  it("rejects a tampered signature", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await createSessionToken("user@example.com");
    const [payload] = token.split(".");
    await expect(readSessionEmail(`${payload}.deadbeef`)).resolves.toBeNull();
  });
});
