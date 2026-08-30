import { describe, expect, it } from "vitest";
import { shouldShowAdminLogin } from "./Home";

describe("admin authentication boundary", () => {
  it("shows login only after auth loading completes without a user", () => {
    expect(shouldShowAdminLogin(false, false)).toBe(true);
    expect(shouldShowAdminLogin(false, true)).toBe(false);
    expect(shouldShowAdminLogin(true, false)).toBe(false);
  });
});
