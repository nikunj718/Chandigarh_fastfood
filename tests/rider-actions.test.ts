import { describe, expect, it } from "vitest";
import { riderMapsUrl, riderPhoneHref } from "@/lib/rider-actions";

describe("rider card actions", () => {
  it("builds Google Maps navigation with the exact saved delivery pin", () => {
    expect(riderMapsUrl(28.6139, 77.209)).toBe("https://www.google.com/maps/dir/?api=1&destination=28.6139,77.209");
  });

  it("formats a decrypted Indian customer contact as a native phone link", () => {
    expect(riderPhoneHref("+91 98765 43210")).toBe("tel:+919876543210");
  });

  it("rejects impossible map coordinates", () => {
    expect(() => riderMapsUrl(91, 77)).toThrow("Invalid delivery coordinates.");
  });
});
