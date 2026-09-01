import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRider } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const currentStopSchema = z.object({ orderId: z.string().uuid() });

export async function PUT(request: NextRequest) {
  try {
    const { orderId } = currentStopSchema.parse(await request.json());
    const { supabase, user } = await requireRider();
    const { data: assignment, error: assignmentError } = await supabase
      .from("delivery_assignments")
      .select("order_id,orders!inner(status)")
      .eq("order_id", orderId)
      .eq("rider_id", user.id)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment || (assignment.orders as unknown as { status: string }).status !== "out_for_delivery") {
      return NextResponse.json({ error: "Choose one of your dispatched deliveries as the current stop." }, { status: 409 });
    }
    const { data, error } = await getSupabaseAdminClient()
      .from("rider_active_stops")
      .upsert({ rider_id: user.id, order_id: orderId, selected_at: new Date().toISOString() }, { onConflict: "rider_id" })
      .select("order_id,selected_at")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Choose a valid assigned delivery." }, { status: 400 });
    return apiError(error, "Current delivery could not be updated.");
  }
}
