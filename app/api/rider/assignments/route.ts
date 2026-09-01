import { NextResponse } from "next/server";
import { apiError, requireRider } from "@/lib/auth";
import { decryptCustomerContact } from "@/lib/customer-contact";
import { riderDeliveryQueueState } from "@/lib/rider-delivery-queue";

export async function GET() {
  try {
    const { supabase, user } = await requireRider();
    const [{ data, error }, { data: activeStop, error: activeStopError }] = await Promise.all([
      supabase.from("delivery_assignments").select("order_id,restaurant_id,assigned_at,orders!inner(id,order_number,status,total,customer_address_snapshot,restaurant_snapshot,delivery_phone_ciphertext)").eq("rider_id", user.id).in("orders.status", ["confirmed", "preparing", "prepared", "out_for_delivery"]).order("assigned_at"),
      supabase.from("rider_active_stops").select("order_id").eq("rider_id", user.id).maybeSingle(),
    ]);
    if (error) throw error;
    if (activeStopError) throw activeStopError;
    const queue = (data ?? []).map((assignment) => {
      const order = assignment.orders as unknown as { id: string; status: string };
      return { orderId: assignment.order_id, status: order.status, assignedAt: assignment.assigned_at };
    });
    return NextResponse.json((data ?? []).map((assignment) => {
      const order = assignment.orders as unknown as { id: string; status: string; delivery_phone_ciphertext?: string | null };
      const { delivery_phone_ciphertext, ...safeOrder } = order;
      return {
        ...assignment,
        queueState: riderDeliveryQueueState(assignment.order_id, activeStop?.order_id ?? null, queue),
        orders: { ...safeOrder, deliveryPhone: delivery_phone_ciphertext ? decryptCustomerContact(delivery_phone_ciphertext) : null },
      };
    }));
  } catch (error) { return apiError(error, "Assignments could not be loaded."); }
}
