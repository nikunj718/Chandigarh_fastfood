import { NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";
import { decryptCustomerContact } from "@/lib/customer-contact";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("delivery_assignments").select("order_id,restaurant_id,assigned_at,orders!inner(id,status,customer_address_snapshot,restaurant_snapshot,delivery_phone_ciphertext)").eq("rider_id", user.id).in("orders.status", ["confirmed", "preparing", "out_for_delivery"]);
    if (error) throw error;
    return NextResponse.json((data ?? []).map((assignment) => {
      const order = assignment.orders as unknown as { delivery_phone_ciphertext?: string | null };
      const { delivery_phone_ciphertext, ...safeOrder } = order;
      return { ...assignment, orders: { ...safeOrder, deliveryPhone: delivery_phone_ciphertext ? decryptCustomerContact(delivery_phone_ciphertext) : null } };
    }));
  } catch (error) { return apiError(error, "Assignments could not be loaded."); }
}
