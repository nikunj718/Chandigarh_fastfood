import { describe, expect, it } from "vitest";
import { acceptsIntoSales, allowedOrderActions, canTransitionOrder, indiaDayBounds, preparationReadyAt, todayInIndia } from "@/lib/order-workflow";

describe("order kitchen and delivery workflow", () => {
  it("requires every kitchen stage before sending an order out", () => {
    expect(allowedOrderActions("pending_approval")).toEqual([{ status: "confirmed", label: "Confirm" }, { status: "cancelled", label: "Cancel" }]);
    expect(canTransitionOrder("pending_approval", "confirmed")).toBe(true);
    expect(canTransitionOrder("confirmed", "preparing")).toBe(true);
    expect(canTransitionOrder("preparing", "prepared")).toBe(true);
    expect(canTransitionOrder("prepared", "out_for_delivery")).toBe(true);
    expect(canTransitionOrder("preparing", "out_for_delivery")).toBe(false);
  });

  it("allows cancellation through the delivery journey but never after delivery", () => {
    expect(canTransitionOrder("out_for_delivery", "cancelled")).toBe(true);
    expect(canTransitionOrder("delivered", "cancelled")).toBe(false);
  });
});

describe("order sales and India calendar helpers", () => {
  it("counts accepted COD and paid online orders, excluding unpaid online orders", () => {
    expect(acceptsIntoSales("prepared", "pending", "cod")).toBe(true);
    expect(acceptsIntoSales("delivered", "paid", "razorpay")).toBe(true);
    expect(acceptsIntoSales("confirmed", "pending", "razorpay")).toBe(false);
    expect(acceptsIntoSales("cancelled", "paid", "razorpay")).toBe(false);
  });

  it("uses Asia/Kolkata day boundaries and derives preparation-ready time", () => {
    expect(todayInIndia(new Date("2026-08-31T19:30:00.000Z"))).toBe("2026-09-01");
    expect(indiaDayBounds("2026-09-01")).toEqual({ start: "2026-08-31T18:30:00.000Z", end: "2026-09-01T18:30:00.000Z" });
    expect(preparationReadyAt("2026-08-31T12:00:00.000Z", 25)).toBe("2026-08-31T12:25:00.000Z");
  });
});
