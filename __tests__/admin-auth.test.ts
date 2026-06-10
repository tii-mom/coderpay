import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAdminEmails } from "@/lib/admin-auth";

// Mock d1-binding for resolveEnvVar
let mockAdminEmails = "";
vi.mock("@/lib/d1-binding", () => ({
  resolveD1: () => null,
  resolveEnvVar: (name: string) => {
    if (name === "ADMIN_EMAILS") return mockAdminEmails;
    return "";
  },
}));

describe("Admin Auth — getAdminEmails", () => {
  beforeEach(() => {
    mockAdminEmails = "";
  });

  it("returns empty array when ADMIN_EMAILS is empty", () => {
    mockAdminEmails = "";
    expect(getAdminEmails()).toEqual([]);
  });

  it("parses single email", () => {
    mockAdminEmails = "admin@example.com";
    expect(getAdminEmails()).toEqual(["admin@example.com"]);
  });

  it("parses comma-separated emails", () => {
    mockAdminEmails = "admin@example.com,ops@example.com";
    expect(getAdminEmails()).toEqual(["admin@example.com", "ops@example.com"]);
  });

  it("trims whitespace around emails", () => {
    mockAdminEmails = " admin@example.com , ops@example.com ";
    expect(getAdminEmails()).toEqual(["admin@example.com", "ops@example.com"]);
  });

  it("lowercases emails", () => {
    mockAdminEmails = "Admin@Example.COM,OPS@EXAMPLE.com";
    expect(getAdminEmails()).toEqual(["admin@example.com", "ops@example.com"]);
  });

  it("filters out empty entries from trailing commas", () => {
    mockAdminEmails = "admin@example.com,,ops@example.com,";
    expect(getAdminEmails()).toEqual(["admin@example.com", "ops@example.com"]);
  });

  it("handles whitespace-only entries", () => {
    mockAdminEmails = "admin@example.com, , ops@example.com";
    expect(getAdminEmails()).toEqual(["admin@example.com", "ops@example.com"]);
  });
});
