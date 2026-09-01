import { describe, expect, it } from "vitest";
import { normalizePaystackTransaction } from "./ticketing";

describe("Paystack transactions", () => {
  it("normalizes transaction fields without exposing raw payload details", () => {
    const transaction = normalizePaystackTransaction({
      id: 42,
      reference: "evt_123",
      amount: 250000,
      currency: "KES",
      status: "success",
      channel: "card",
      paid_at: "2026-08-30T10:00:00.000Z",
      customer: { email: "buyer@example.com", first_name: "Amina" },
    });
    expect(transaction).toEqual({
      id: 42,
      reference: "evt_123",
      amount: 250000,
      currency: "KES",
      status: "success",
      channel: "card",
      paidAt: "2026-08-30T10:00:00.000Z",
      createdAt: null,
      customerEmail: "buyer@example.com",
      customerName: "Amina",
    });
  });

  it("uses safe fallback values for incomplete Paystack records", () => {
    expect(normalizePaystackTransaction({ status: "abandoned" })).toMatchObject({
      amount: 0,
      currency: "KES",
      status: "abandoned",
      customerEmail: "—",
    });
  });
});
