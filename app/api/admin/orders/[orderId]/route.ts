import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { canTransitionOrder, orderStatuses } from "@/lib/order-workflow";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const statusSchema = z.object({
  status: z.enum(orderStatuses).refine((status) => !["pending_payment", "pending_approval"].includes(status)),
  preparationMinutes: z.number().int().min(1).max(240).optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    const { status, preparationMinutes } = statusSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: order, error: orderLookupError } = await admin.from("orders").select("restaurant_id").eq("id", orderId).maybeSingle();
    if (orderLookupError) throw orderLookupError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const { supabase } = await requireRestaurantManager(order.restaurant_id);
    const { data: currentOrder, error: orderError } = await admin.from("orders").select("status").eq("id", orderId).single();
    if (orderError) throw orderError;
    if (!canTransitionOrder(currentOrder.status, status)) return NextResponse.json({ error: "This order cannot make that status transition." }, { status: 409 });
    if (status === "confirmed" && !preparationMinutes) {
      return NextResponse.json({ error: "Enter the preparation time in minutes before confirming this order." }, { status: 400 });
    }
    if (status === "out_for_delivery") {
      const { data: assignment, error: assignmentError } = await supabase.from("delivery_assignments").select("rider_id").eq("order_id", orderId).maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return NextResponse.json({ error: "Assign a rider before starting delivery tracking." }, { status: 409 });
    }
    const now = new Date().toISOString();
    const timelinePayload = {
      ...(status === "confirmed" ? { confirmed_at: now, preparation_minutes: preparationMinutes } : {}),
      ...(status === "preparing" ? { preparing_at: now } : {}),
      ...(status === "prepared" ? { prepared_at: now } : {}),
      ...(status === "out_for_delivery" ? { out_for_delivery_at: now } : {}),
      ...(status === "delivered" ? { delivered_at: now } : {}),
      ...(status === "cancelled" ? { cancelled_at: now } : {}),
    };
    const { data, error } = await admin.from("orders").update({ status, ...timelinePayload }).eq("id", orderId).select("id,status,preparation_minutes,confirmed_at,preparing_at,prepared_at,out_for_delivery_at,delivered_at,cancelled_at").single();
    if (error) throw error;
    if (status === "delivered" || status === "cancelled") {
      const { error: activeStopError } = await admin.from("rider_active_stops").delete().eq("order_id", orderId);
      if (activeStopError) throw activeStopError;
    }
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
    return apiError(error, "Order status could not be updated.");
  }
}
