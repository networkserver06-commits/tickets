import { describe, expect, it } from "vitest";
import { createPaymentReference, formatKes, isValidKenyanPhone, normalizeKenyanPhone } from "./EventStorefront";

describe("formatKes", () => {
  it("formats Paystack cents as Kenyan Shillings", () => {
    expect(formatKes(250000)).toContain("KSh");
    expect(formatKes(250000)).toContain("2,500");
  });
});

describe("payment references", () => {
  it("creates unique Passage references", () => {
    const first = createPaymentReference();
    const second = createPaymentReference();
    expect(first).toMatch(/^passage-/);
    expect(second).toMatch(/^passage-/);
    expect(first).not.toBe(second);
  });
});

describe("Kenyan phone numbers", () => {
  it("accepts common local formats and normalizes to +254", () => {
    expect(isValidKenyanPhone("0723 000 000")).toBe(true);
    expect(isValidKenyanPhone("0116-000-000")).toBe(true);
    expect(isValidKenyanPhone("+254 723 000 000")).toBe(true);
    expect(normalizeKenyanPhone("0723 000 000")).toBe("+254723000000");
    expect(normalizeKenyanPhone("0116-000-000")).toBe("+254116000000");
  });

  it("rejects unsupported or incomplete phone numbers", () => {
    expect(isValidKenyanPhone("0800 000 000")).toBe(false);
    expect(isValidKenyanPhone("0723 000")).toBe(false);
  });
});
