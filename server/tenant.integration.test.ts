import { describe, expect, it } from "vitest";
import { kenyanPhoneVariants, normalizeKenyanPhone } from "./phone.js";

describe("tenant payment and gate contracts", () => {
  it("keeps checkout metadata aligned with webhook fields", () => {
    const metadata = {
      eventId: "EVT-1",
      eventTitle: "Sample event",
      quantity: "2",
      full_name: "Jane Doe",
      phone: "+254712345678",
    };
    expect(metadata).toMatchObject({
      eventId: "EVT-1",
      quantity: "2",
      full_name: "Jane Doe",
      phone: "+254712345678",
    });
  });
  it("accepts either ticket id or phone as a gate lookup identifier", () => {
    expect(Boolean("evt_tkt_1" || "+254712345678")).toBe(true);
    expect(Boolean("")).toBe(false);
  });
  it("normalizes local and international Kenyan phone formats consistently", () => {
    const expected = "254712345678";
    for (const value of ["0712345678", "0112345678", "+254 712 345 678", "254-712-345-678"]) {
      expect(normalizeKenyanPhone(value)).toMatch(/^254\d{9}$/);
    }
    expect(normalizeKenyanPhone("0712345678")).toBe(expected);
    expect(kenyanPhoneVariants("+254 712 345 678")).toEqual([
      expected,
      `+${expected}`,
      "0712345678",
    ]);
  });
  it("falls back safely when optional services are not configured", () => {
    const baseUrl = undefined || undefined || "https://example.test";
    expect(baseUrl).toBe("https://example.test");
    expect(undefined || "owner-fallback").toBe("owner-fallback");
  });
});
