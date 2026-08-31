import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { CredentialConfigurationError, decryptCredential } from "@/lib/restaurant-credentials";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

type RazorpayWebhookPayload = {
  event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
};

function signaturesMatch(actual: string | null, expected: string) {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function parseWebhookPayload(rawBody: string) {
  try {
    return JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const payload = parseWebhookPayload(rawBody);
    const payment = payload?.payload?.payment?.entity;
    if (!payload?.event || !payment?.order_id) {
      return NextResponse.json({ error: "Webhook payload does not identify a Razorpay order." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,restaurant_id,razorpay_webhook_secret_snapshot")
      .eq("razorpay_order_id", payment.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order?.razorpay_webhook_secret_snapshot) {
      return NextResponse.json({ error: "Unknown Razorpay order." }, { status: 404 });
    }

    const webhookSecret = decryptCredential(order.razorpay_webhook_secret_snapshot);
    const expectedSignature = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (!signaturesMatch(request.headers.get("x-razorpay-signature"), expectedSignature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventId = request.headers.get("x-razorpay-event-id") || `${payload.event}:${payment.id ?? payment.order_id}`;
    const { error: eventError } = await admin.from("razorpay_webhook_events").insert({ event_id: eventId, event_type: payload.event, restaurant_id: order.restaurant_id, payload });
    if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    if (eventError) throw eventError;

    if (payload.event === "payment.captured" && payment.id) {
      const { error } = await admin.from("orders").update({ status: "pending_approval", payment_status: "paid", razorpay_payment_id: payment.id }).eq("id", order.id).eq("payment_status", "pending");
      if (error) throw error;
    }
    if (payload.event === "payment.failed") {
      const { error } = await admin.from("orders").update({ payment_status: "failed" }).eq("id", order.id).eq("payment_status", "pending");
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof CredentialConfigurationError) {
      console.error("Razorpay webhook credential configuration failed", error.message);
      return NextResponse.json({ error: "Webhook credentials are unavailable." }, { status: 503 });
    }
    console.error("Razorpay webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
