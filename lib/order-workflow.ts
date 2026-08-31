export const orderStatuses = ["pending_payment", "pending_approval", "confirmed", "preparing", "prepared", "out_for_delivery", "delivered", "cancelled"] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export type OrderAction = {
  status: Exclude<OrderStatus, "pending_payment" | "pending_approval">;
  label: string;
};

const transitions: Record<OrderStatus, OrderAction[]> = {
  pending_payment: [],
  pending_approval: [{ status: "confirmed", label: "Confirm" }, { status: "cancelled", label: "Cancel" }],
  confirmed: [{ status: "preparing", label: "Start preparing" }, { status: "cancelled", label: "Cancel" }],
  preparing: [{ status: "prepared", label: "Mark prepared" }, { status: "cancelled", label: "Cancel" }],
  prepared: [{ status: "out_for_delivery", label: "Send out for delivery" }, { status: "cancelled", label: "Cancel" }],
  out_for_delivery: [{ status: "delivered", label: "Mark delivered" }, { status: "cancelled", label: "Cancel" }],
  delivered: [],
  cancelled: [],
};

export const acceptedOrderStatuses = new Set<OrderStatus>(["confirmed", "preparing", "prepared", "out_for_delivery", "delivered"]);

export function allowedOrderActions(status: string): OrderAction[] {
  return transitions[status as OrderStatus] ?? [];
}

export function canTransitionOrder(currentStatus: string, nextStatus: string): boolean {
  return allowedOrderActions(currentStatus).some((action) => action.status === nextStatus);
}

export function acceptsIntoSales(status: string, paymentStatus: string, paymentMethod: string): boolean {
  return acceptedOrderStatuses.has(status as OrderStatus)
    && (paymentMethod === "cod" || paymentStatus === "paid");
}

export function indiaDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

export function todayInIndia(now = new Date()): string {
  const { year, month, day } = indiaDateParts(now);
  return `${year}-${month}-${day}`;
}

export function indiaDayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_ORDER_DATE");
  const start = new Date(`${date}T00:00:00+05:30`);
  if (Number.isNaN(start.getTime())) throw new Error("INVALID_ORDER_DATE");
  return { start: start.toISOString(), end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString() };
}

export function preparationReadyAt(confirmedAt: string | null, preparationMinutes: number | null): string | null {
  if (!confirmedAt || !preparationMinutes) return null;
  const confirmedAtMs = new Date(confirmedAt).getTime();
  if (Number.isNaN(confirmedAtMs)) return null;
  return new Date(confirmedAtMs + preparationMinutes * 60 * 1000).toISOString();
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  pending_approval: "Awaiting confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  prepared: "Prepared",
  out_for_delivery: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
