import { NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("delivery_assignments").select("order_id,restaurant_id,assigned_at,orders!inner(id,status,customer_address_snapshot,restaurant_snapshot)").eq("rider_id", user.id).in("orders.status", ["confirmed", "preparing", "out_for_delivery"]);
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) { return apiError(error, "Assignments could not be loaded."); }
}
