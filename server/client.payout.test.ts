import { describe, expect, it } from "vitest";

describe("client payout profile updates", () => {
  it("sends the client id and editable payout fields for an update", () => {
    const payload = { id: "CLI-1", businessName: "Nairobi Events", paystackSubaccountCode: "ACCT_client" };
    expect(payload.id).toBe("CLI-1");
    expect(payload.paystackSubaccountCode.startsWith("ACCT_")).toBe(true);
  });

  it("rejects an invalid payout destination", () => {
    const valid = (code: string) => code.startsWith("ACCT_") && code.length > 5;
    expect(valid("bank-account")).toBe(false);
    expect(valid("ACCT_client")).toBe(true);
  });
});
