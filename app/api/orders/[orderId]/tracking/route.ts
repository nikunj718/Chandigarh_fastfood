import { NextRequest, NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";
import { estimateDeliveryRoute } from "@/lib/delivery";

export async function GET(_request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    const { supabase } = await requireUser();
    const { data: order, error } = await supabase.from("orders").select("id,status,payment_status,created_at,restaurant_snapshot,customer_address_snapshot,delivery_assignments(rider_id)").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "This delivery is unavailable." }, { status: 404 });
    const { data: points, error: pointError } = await supabase.from("delivery_location_points").select("latitude,longitude,accuracy_meters,recorded_at").eq("order_id", orderId).order("recorded_at", { ascending: false }).limit(1);
    if (pointError) throw pointError;
    const restaurant = order.restaurant_snapshot as { name: string; latitude: number; longitude: number; address_text?: string };
    const address = order.customer_address_snapshot as { latitude: number; longitude: number; address_text: string };
    const latest = points?.[0] ? { latitude: Number(points[0].latitude), longitude: Number(points[0].longitude), accuracyMeters: Number(points[0].accuracy_meters ?? 0), recordedAt: points[0].recorded_at } : null;
    const liveRoute = estimateDeliveryRoute(latest ?? restaurant, address);
    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      paymentStatus: order.payment_status,
      restaurant,
      customerAddress: address,
      rider: latest,
      riderAssigned: Boolean(order.delivery_assignments?.length),
      etaSeconds: liveRoute?.durationSeconds ?? null,
      route: liveRoute?.geometry ?? null,
    });
  } catch (error) { return apiError(error, "Tracking data could not be loaded."); }
}
