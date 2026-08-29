import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager, requireUser } from "@/lib/auth";

const statusSchema = z.object({ status: z.enum(["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]) });
const transitions: Record<string, string[]> = {
  pending_approval: ["confirmed", "cancelled"], confirmed: ["preparing", "cancelled"], preparing: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"], delivered: [], cancelled: [], pending_payment: [],
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    const { status } = statusSchema.parse(await request.json());
    const { supabase: userClient } = await requireUser();
    const { data: order, error: orderLookupError } = await userClient.from("orders").select("restaurant_id").eq("id", orderId).maybeSingle();
    if (orderLookupError) throw orderLookupError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const { supabase } = await requireRestaurantManager(order.restaurant_id);
    const { data: currentOrder, error: orderError } = await supabase.from("orders").select("status").eq("id", orderId).single();
    if (orderError) throw orderError;
    if (!transitions[currentOrder.status]?.includes(status)) return NextResponse.json({ error: "This order cannot make that status transition." }, { status: 409 });
    if (status === "out_for_delivery") {
      const { data: assignment, error: assignmentError } = await supabase.from("delivery_assignments").select("rider_id").eq("order_id", orderId).maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return NextResponse.json({ error: "Assign a rider before starting delivery tracking." }, { status: 409 });
    }
    const { data, error } = await supabase.from("orders").update({ status }).eq("id", orderId).select("id,status").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
    return apiError(error, "Order status could not be updated.");
  }
}
