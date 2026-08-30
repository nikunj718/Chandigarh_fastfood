import { describe, expect, it } from "vitest";
import { authCallbackUrl, safeNextPath } from "@/lib/auth-redirect";
import { isVerifiedUser } from "@/lib/identity";

describe("authentication redirect safety", () => {
  it("keeps only same-origin application paths", () => {
    expect(safeNextPath("/restaurants/demo?startRestaurant=1")).toBe("/restaurants/demo?startRestaurant=1");
    expect(safeNextPath("https://attacker.example")).toBe("/restaurants");
    expect(safeNextPath("//attacker.example")).toBe("/restaurants");
    expect(authCallbackUrl("https://app.example", "/restaurants/demo")).toBe("https://app.example/auth/callback?next=%2Frestaurants%2Fdemo");
  });
});

describe("confirmed identity requirement", () => {
  it("accepts confirmed email identities and rejects anonymous or unconfirmed users", () => {
    expect(isVerifiedUser({ email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false })).toBe(true);
    expect(isVerifiedUser({ email: "owner@example.com", email_confirmed_at: null, is_anonymous: false })).toBe(false);
    expect(isVerifiedUser({ email: null, email_confirmed_at: null, is_anonymous: true })).toBe(false);
  });
});
