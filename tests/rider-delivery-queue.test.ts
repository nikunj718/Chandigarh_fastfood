import { describe, expect, it } from "vitest";
import { riderDeliveryQueueState } from "@/lib/rider-delivery-queue";

const assignments = [
  { orderId: "order-current", status: "out_for_delivery", assignedAt: "2026-09-01T08:00:00.000Z" },
  { orderId: "order-next", status: "out_for_delivery", assignedAt: "2026-09-01T08:05:00.000Z" },
  { orderId: "order-later", status: "out_for_delivery", assignedAt: "2026-09-01T08:10:00.000Z" },
  { orderId: "order-prepared", status: "prepared", assignedAt: "2026-09-01T08:15:00.000Z" },
];

describe("rider multi-stop delivery queue", () => {
  it("marks the rider-selected stop as current and the oldest remaining delivery as next", () => {
    expect(riderDeliveryQueueState("order-current", "order-current", assignments)).toBe("current");
    expect(riderDeliveryQueueState("order-next", "order-current", assignments)).toBe("next");
    expect(riderDeliveryQueueState("order-later", "order-current", assignments)).toBe("waiting");
  });

  it("does not promise an ETA before a rider selects the current dispatched stop", () => {
    expect(riderDeliveryQueueState("order-next", null, assignments)).toBe("waiting");
    expect(riderDeliveryQueueState("order-prepared", "order-current", assignments)).toBe("upcoming");
  });
});
