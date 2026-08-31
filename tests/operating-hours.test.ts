import { describe, expect, it } from "vitest";
import { foodImageExtension, foodImageObjectPath, MAX_FOOD_IMAGE_BYTES } from "@/lib/menu-media";
import { defaultOperatingHours, isRestaurantOpenNow, normalizeOperatingHours, operatingHoursSchema } from "@/lib/operating-hours";

describe("restaurant operating hours", () => {
  it("starts closed and accepts a valid weekly schedule", () => {
    expect(isRestaurantOpenNow(defaultOperatingHours(), new Date("2026-01-04T05:30:00Z"))).toBe(false);
    const hours = defaultOperatingHours();
    hours[0] = { dayOfWeek: 0, isClosed: false, opensAt: "10:00", closesAt: "22:00" };
    expect(operatingHoursSchema.parse(hours)).toHaveLength(7);
    expect(isRestaurantOpenNow(hours, new Date("2026-01-04T05:30:00Z"))).toBe(true); // Sunday 11:00 in India
  });

  it("supports overnight windows using the previous Indian calendar day", () => {
    const hours = defaultOperatingHours();
    hours[0] = { dayOfWeek: 0, isClosed: false, opensAt: "22:00", closesAt: "02:00" };
    expect(isRestaurantOpenNow(hours, new Date("2026-01-04T19:30:00Z"))).toBe(true); // Monday 01:00 India
    expect(isRestaurantOpenNow(hours, new Date("2026-01-04T21:30:00Z"))).toBe(false); // Monday 03:00 India
  });

  it("normalizes database time values for browser controls", () => {
    const hours = normalizeOperatingHours([{ day_of_week: 2, is_closed: false, opens_at: "09:30:00", closes_at: "18:00:00" }]);
    expect(hours[2]).toEqual({ dayOfWeek: 2, isClosed: false, opensAt: "09:30", closesAt: "18:00" });
  });
});

describe("food image validation", () => {
  it("only accepts public storefront image types under the five-megabyte limit", () => {
    expect(foodImageExtension("image/jpeg")).toBe("jpg");
    expect(foodImageExtension("image/webp")).toBe("webp");
    expect(foodImageExtension("image/svg+xml")).toBeNull();
    expect(MAX_FOOD_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("only cleans up the deleted dish's own storage object", () => {
    expect(foodImageObjectPath("https://example.supabase.co/storage/v1/object/public/restaurant-food-images/restaurant-1/item-1/photo.jpg", "restaurant-1", "item-1")).toBe("restaurant-1/item-1/photo.jpg");
    expect(foodImageObjectPath("https://example.supabase.co/storage/v1/object/public/restaurant-food-images/restaurant-1/item-2/photo.jpg", "restaurant-1", "item-1")).toBeNull();
    expect(foodImageObjectPath("https://example.supabase.co/storage/v1/object/public/another-bucket/restaurant-1/item-1/photo.jpg", "restaurant-1", "item-1")).toBeNull();
  });
});
