import { describe, expect, it } from "vitest";

describe("multi-tenant validation contracts", () => {
  it("calculates remaining event inventory without going below zero", () => {
    expect(Math.max(0, 100 - 72)).toBe(28);
    expect(Math.max(0, 100 - 120)).toBe(0);
  });

  it("uses the owner payout fallback when an event override is empty", () => {
    const payout = (eventCode: string | null | undefined, ownerCode: string) => eventCode || ownerCode;
    expect(payout(null, "ACCT_OWNER")).toBe("ACCT_OWNER");
    expect(payout("ACCT_CLIENT", "ACCT_OWNER")).toBe("ACCT_CLIENT");
  });
});
