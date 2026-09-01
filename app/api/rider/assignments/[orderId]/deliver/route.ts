import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRider } from "@/lib/auth";

const orderIdSchema = z.string().uuid();

export async function POST(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    const parsedOrderId = orderIdSchema.parse(orderId);
    const { supabase } = await requireRider();
    const { data, error } = await supabase.rpc("complete_rider_delivery", { target_order_id: parsedOrderId }).single();
    if (error) {
      if (error.code === "P0001") return NextResponse.json({ error: error.message }, { status: 409 });
      if (error.code === "42501") return NextResponse.json({ error: "Only a confirmed rider can complete this delivery." }, { status: 403 });
      throw error;
    }
    const completion = data as { order_id: string; delivered_at: string } | null;
    if (!completion) throw new Error("Delivery completion did not return an order.");
    return NextResponse.json({ orderId: completion.order_id, status: "delivered", deliveredAt: completion.delivered_at });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid delivery." }, { status: 400 });
    return apiError(error, "Delivery could not be marked as delivered.");
  }
}
