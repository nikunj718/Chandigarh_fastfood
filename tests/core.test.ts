import { describe, expect, it } from "vitest";
import { calculateDeliveryFee, haversineKm } from "@/lib/geospatial";
import { normalizeIndianPhone } from "@/lib/utils";
import { updateCartLine } from "@/store/useCartStore";

describe("India delivery phone validation", () => {
  it("normalizes a valid mobile number to E.164", () => {
    expect(normalizeIndianPhone("98765 43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeIndianPhone("12345")).toBeNull();
  });
});

describe("restaurant-scoped delivery mathematics", () => {
  it("calculates base plus per-km fees to two decimals", () => {
    expect(calculateDeliveryFee(20, 8.5, 3.125)).toBe(46.56);
  });
  it("computes approximate directory distance", () => {
    expect(haversineKm({ latitude: 30.7333, longitude: 76.7794 }, { latitude: 30.7046, longitude: 76.7179 })).toBeGreaterThan(3);
  });
});

describe("separate restaurant cart drafts", () => {
  it("adds, increments, and removes an item without affecting unrelated restaurant state", () => {
    const first = updateCartLine([], "burger", 1);
    expect(first).toEqual([{ itemId: "burger", quantity: 1 }]);
    expect(updateCartLine(first, "burger", 2)).toEqual([{ itemId: "burger", quantity: 2 }]);
    expect(updateCartLine(first, "burger", 0)).toEqual([]);
    expect(first).toEqual([{ itemId: "burger", quantity: 1 }]);
  });
});
