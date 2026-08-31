import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const assignmentSchema = z.object({ riderId: z.string().uuid() });

export async function PUT(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    const { riderId } = assignmentSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    const { data: order, error: orderError } = await admin.from("orders").select("restaurant_id,status").eq("id", orderId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (["pending_payment", "delivered", "cancelled"].includes(order.status)) return NextResponse.json({ error: "A rider cannot be assigned in this order state." }, { status: 409 });
    const { supabase, user } = await requireRestaurantManager(order.restaurant_id);
    const { data: rider, error: riderError } = await supabase.from("restaurant_memberships").select("user_id").eq("restaurant_id", order.restaurant_id).eq("user_id", riderId).eq("role", "rider").maybeSingle();
    if (riderError) throw riderError;
    if (!rider) return NextResponse.json({ error: "That rider is not available for this restaurant." }, { status: 400 });
    const { data, error } = await admin.from("delivery_assignments").upsert({ order_id: orderId, restaurant_id: order.restaurant_id, rider_id: riderId, assigned_by: user.id }, { onConflict: "order_id" }).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid rider." }, { status: 400 });
    return apiError(error, "Rider assignment could not be saved.");
  }
}
