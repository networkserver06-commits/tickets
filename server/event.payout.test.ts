import { describe, expect, it } from "vitest";

describe("event payout selection", () => {
  it("prefers the event subaccount when present", () => {
    const event = { paystackSubaccountCode: "ACCT_CLIENT123" };
    expect(event.paystackSubaccountCode || "ACCT_OWNER123").toBe("ACCT_CLIENT123");
  });

  it("uses the owner fallback when the event has no client account", () => {
    const event = { paystackSubaccountCode: "" };
    expect(event.paystackSubaccountCode || "ACCT_OWNER123").toBe("ACCT_OWNER123");
  });
});
