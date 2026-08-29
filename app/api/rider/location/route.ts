import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";

const locationSchema = z.object({
  orderId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = locationSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    const { data: assignment, error: assignmentError } = await supabase.from("delivery_assignments").select("restaurant_id,orders!inner(status)").eq("order_id", input.orderId).eq("rider_id", user.id).maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment || (assignment.orders as unknown as { status: string }).status !== "out_for_delivery") return NextResponse.json({ error: "You are not assigned to an active delivery." }, { status: 403 });
    const { error } = await supabase.from("delivery_location_points").insert({ order_id: input.orderId, restaurant_id: assignment.restaurant_id, rider_id: user.id, latitude: input.latitude, longitude: input.longitude, accuracy_meters: input.accuracyMeters ?? null });
    if (error) throw error;
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid location payload." }, { status: 400 });
    return apiError(error, "Location update could not be saved.");
  }
}
