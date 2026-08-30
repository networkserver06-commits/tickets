import { describe, expect, it } from "vitest";
import { formatKes } from "./EventStorefront";

describe("formatKes", () => {
  it("formats Paystack cents as Kenyan Shillings", () => {
    expect(formatKes(250000)).toContain("KSh");
    expect(formatKes(250000)).toContain("2,500");
  });
});
