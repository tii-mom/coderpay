import { describe, expect, it } from "vitest";
import { amountToCents, formatCents } from "@/lib/money";

describe("money conversion", () => {
  it("converts decimal API amounts to integer cents", () => {
    expect(amountToCents("19.90")).toBe(1990);
    expect(amountToCents("19.9")).toBe(1990);
    expect(amountToCents("19.91")).toBe(1991);
    expect(formatCents(1990)).toBe("19.90");
  });

  it("rejects invalid payment amounts", () => {
    expect(() => amountToCents("19.999")).toThrow(/Invalid amount/);
    expect(() => amountToCents("0")).toThrow(/greater than 0/);
  });
});
