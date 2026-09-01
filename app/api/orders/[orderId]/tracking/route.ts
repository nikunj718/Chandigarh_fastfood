import { NextRequest, NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";
import { estimateDeliveryRoute } from "@/lib/delivery";
import { preparationReadyAt } from "@/lib/order-workflow";
import { riderDeliveryQueueState, type RiderAssignmentQueueItem } from "@/lib/rider-delivery-queue";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    const { supabase } = await requireUser();
    const { data: order, error } = await supabase.from("orders").select("id,order_number,status,payment_status,created_at,preparation_minutes,confirmed_at,preparing_at,prepared_at,out_for_delivery_at,restaurant_snapshot,customer_address_snapshot,delivery_assignments(rider_id)").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "This delivery is unavailable." }, { status: 404 });
    const { data: points, error: pointError } = await supabase.from("delivery_location_points").select("latitude,longitude,accuracy_meters,recorded_at").eq("order_id", orderId).order("recorded_at", { ascending: false }).limit(1);
    if (pointError) throw pointError;
    const restaurant = order.restaurant_snapshot as { name: string; latitude: number; longitude: number; address_text?: string };
    const address = order.customer_address_snapshot as { latitude: number; longitude: number; address_text: string };
    const latest = points?.[0] ? { latitude: Number(points[0].latitude), longitude: Number(points[0].longitude), accuracyMeters: Number(points[0].accuracy_meters ?? 0), recordedAt: points[0].recorded_at } : null;
    const riderId = order.delivery_assignments?.[0]?.rider_id ?? null;
    let deliveryQueue: ReturnType<typeof riderDeliveryQueueState> = "upcoming";
    if (riderId && order.status === "out_for_delivery") {
      const admin = getSupabaseAdminClient();
      const [{ data: activeStop, error: activeStopError }, { data: riderAssignments, error: riderAssignmentsError }] = await Promise.all([
        admin.from("rider_active_stops").select("order_id").eq("rider_id", riderId).maybeSingle(),
        admin.from("delivery_assignments").select("order_id,assigned_at,orders!inner(status)").eq("rider_id", riderId).eq("orders.status", "out_for_delivery"),
      ]);
      if (activeStopError) throw activeStopError;
      if (riderAssignmentsError) throw riderAssignmentsError;
      const queue: RiderAssignmentQueueItem[] = (riderAssignments ?? []).map((assignment) => ({
        orderId: assignment.order_id,
        assignedAt: assignment.assigned_at,
        status: (assignment.orders as unknown as { status: string }).status,
      }));
      deliveryQueue = riderDeliveryQueueState(order.id, activeStop?.order_id ?? null, queue);
    }
    const liveRoute = deliveryQueue === "current" ? estimateDeliveryRoute(latest ?? restaurant, address) : null;
    const preparationIsVisible = order.status === "confirmed" || order.status === "preparing";
    const preparationMinutes = order.preparation_minutes ? Number(order.preparation_minutes) : null;
    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      restaurant,
      customerAddress: address,
      rider: deliveryQueue === "current" ? latest : null,
      riderAssigned: Boolean(order.delivery_assignments?.length),
      deliveryQueue,
      preparation: preparationIsVisible && preparationMinutes ? {
        minutes: preparationMinutes,
        readyAt: preparationReadyAt(order.confirmed_at, preparationMinutes),
      } : null,
      etaSeconds: liveRoute?.durationSeconds ?? null,
      estimatedDeliveryAt: liveRoute ? new Date(Date.now() + liveRoute.durationSeconds * 1000).toISOString() : null,
      route: liveRoute?.geometry ?? null,
    });
  } catch (error) { return apiError(error, "Tracking data could not be loaded."); }
}
