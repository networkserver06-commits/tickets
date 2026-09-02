import crypto from "node:crypto";
import { describe, expect, it, afterEach } from "vitest";
import { signatureMatches } from "./ticketing";

describe("Paystack webhook signature verification", () => {
  afterEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  it("accepts the HMAC-SHA512 signature for the exact raw body", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const body = '{"event":"charge.success"}';
    const signature = crypto
      .createHmac("sha512", "test-secret")
      .update(body)
      .digest("hex");
    expect(signatureMatches(body, signature)).toBe(true);
  });

  it("rejects tampered bodies and missing signatures", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const signature = crypto
      .createHmac("sha512", "test-secret")
      .update("original")
      .digest("hex");
    expect(signatureMatches("tampered", signature)).toBe(false);
    expect(signatureMatches("original", undefined)).toBe(false);
  });
});
