import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertServerEnv, env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function signaturesMatch(actual: string | null, expected: string) {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(request: NextRequest) {
  try {
    assertServerEnv("razorpayWebhookSecret");
    const rawBody = await request.text();
    const expected = createHmac("sha256", env.razorpayWebhookSecret!).update(rawBody).digest("hex");
    if (!signaturesMatch(request.headers.get("x-razorpay-signature"), expected)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    const payload = JSON.parse(rawBody) as { event: string; payload: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } } };
    const eventId = request.headers.get("x-razorpay-event-id") || `${payload.event}:${payload.payload.payment?.entity?.id}`;
    const admin = getSupabaseAdminClient();
    const { error: eventError } = await admin.from("razorpay_webhook_events").insert({ event_id: eventId, event_type: payload.event, payload });
    if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    if (eventError) throw eventError;
    const payment = payload.payload.payment?.entity;
    if (payload.event === "payment.captured" && payment?.order_id && payment.id) {
      const { error } = await admin.from("orders").update({ status: "confirmed", payment_status: "paid", razorpay_payment_id: payment.id }).eq("razorpay_order_id", payment.order_id).eq("payment_status", "pending");
      if (error) throw error;
    }
    if (payload.event === "payment.failed" && payment?.order_id) {
      const { error } = await admin.from("orders").update({ payment_status: "failed" }).eq("razorpay_order_id", payment.order_id).eq("payment_status", "pending");
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
