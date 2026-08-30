import { describe, expect, it } from "vitest";
import { authCallbackUrl, cleanReturnPath, returnPathFromRequest, safeNextPath, safeReturnPath, signInUrl } from "@/lib/auth-redirect";
import { isVerifiedUser } from "@/lib/identity";
import { managementDestination } from "@/lib/session-routing";

describe("authentication redirect safety", () => {
  it("keeps only same-origin application paths", () => {
    expect(safeNextPath("/restaurants/demo?startRestaurant=1")).toBe("/restaurants/demo?startRestaurant=1");
    expect(safeNextPath("https://attacker.example")).toBe("/restaurants");
    expect(safeNextPath("//attacker.example")).toBe("/restaurants");
    expect(authCallbackUrl("https://app.example", "/restaurants/demo")).toBe("https://app.example/auth/callback?next=%2Frestaurants%2Fdemo");
    expect(safeReturnPath("https://attacker.example")).toBeNull();
    expect(authCallbackUrl("https://app.example")).toBe("https://app.example/auth/callback");
  });

  it("preserves an existing root destination without nesting next parameters", () => {
    expect(cleanReturnPath("/admin?next=%2Ftracking%2Forder-1")).toBe("/tracking/order-1");
    expect(cleanReturnPath("/admin?next=%2Frider%3Fnext%3D%252Frestaurants")).toBe("/restaurants");
    expect(cleanReturnPath("/admin?next=%2F%2Fattacker.example")).toBeNull();
    expect(returnPathFromRequest("/admin", "?next=%2Ftracking%2Forder-1")).toBe("/tracking/order-1");
    expect(returnPathFromRequest("/admin", "")).toBe("/admin");
    expect(returnPathFromRequest("/admin", "?next=https%3A%2F%2Fattacker.example")).toBeNull();
    expect(signInUrl("/admin?next=%2Ftracking%2Forder-1")).toBe("/?next=%2Ftracking%2Forder-1");
  });
});

describe("post-auth session landing", () => {
  it("routes customers and rider-only users to the restaurant directory", () => {
    expect(managementDestination([])).toBe("/restaurants");
  });

  it("opens a single owner or manager restaurant directly", () => {
    expect(managementDestination([{ id: "restaurant-1" }])).toBe("/admin/restaurant-1");
  });

  it("opens the management picker for multiple restaurants", () => {
    expect(managementDestination([{ id: "restaurant-1" }, { id: "restaurant-2" }])).toBe("/admin");
  });
});

describe("confirmed identity requirement", () => {
  it("accepts confirmed email identities and rejects anonymous or unconfirmed users", () => {
    expect(isVerifiedUser({ email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false })).toBe(true);
    expect(isVerifiedUser({ email: "owner@example.com", email_confirmed_at: null, is_anonymous: false })).toBe(false);
    expect(isVerifiedUser({ email: null, email_confirmed_at: null, is_anonymous: true })).toBe(false);
  });
});
