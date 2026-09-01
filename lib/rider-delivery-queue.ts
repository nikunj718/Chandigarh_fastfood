export type RiderAssignmentQueueItem = {
  orderId: string;
  status: string;
  assignedAt: string;
};

export type RiderDeliveryQueueState = "upcoming" | "current" | "next" | "waiting";

export function riderDeliveryQueueState(orderId: string, currentOrderId: string | null, assignments: RiderAssignmentQueueItem[]): RiderDeliveryQueueState {
  const assignment = assignments.find((entry) => entry.orderId === orderId);
  if (!assignment || assignment.status !== "out_for_delivery") return "upcoming";
  if (currentOrderId === orderId) return "current";
  if (!currentOrderId) return "waiting";
  const nextOrder = assignments
    .filter((entry) => entry.status === "out_for_delivery" && entry.orderId !== currentOrderId)
    .sort((left, right) => left.assignedAt.localeCompare(right.assignedAt))[0];
  return nextOrder?.orderId === orderId ? "next" : "waiting";
}
