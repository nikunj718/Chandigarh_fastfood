import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRider } from "@/lib/auth";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const input = locationSchema.parse(await request.json());
    const { supabase, user } = await requireRider();
    const { data: assignments, error: assignmentError } = await supabase.from("delivery_assignments").select("order_id,restaurant_id,orders!inner(status)").eq("rider_id", user.id).eq("orders.status", "out_for_delivery");
    if (assignmentError) throw assignmentError;
    if (!assignments?.length) return NextResponse.json({ error: "You are not assigned to an active delivery." }, { status: 409 });
    const { error } = await supabase.from("delivery_location_points").insert(assignments.map((assignment) => ({ order_id: assignment.order_id, restaurant_id: assignment.restaurant_id, rider_id: user.id, latitude: input.latitude, longitude: input.longitude, accuracy_meters: input.accuracyMeters ?? null })));
    if (error) throw error;
    return NextResponse.json({ saved: true, deliveriesUpdated: assignments.length });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid location payload." }, { status: 400 });
    return apiError(error, "Location update could not be saved.");
  }
}
