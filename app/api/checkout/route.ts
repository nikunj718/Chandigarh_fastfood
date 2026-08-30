import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";
import { createDeliveryQuote } from "@/lib/delivery";
import { CredentialConfigurationError, decryptRazorpayCredentials, type RazorpayCredentials } from "@/lib/restaurant-credentials";
import { CustomerContactError, encryptCustomerContact, lastFourDigits } from "@/lib/customer-contact";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeIndianPhone } from "@/lib/utils";

const checkoutSchema = z.object({
  restaurantId: z.string().uuid(),
  addressId: z.string().uuid(),
  paymentMethod: z.enum(["cod", "razorpay"]),
  idempotencyKey: z.string().uuid(),
  deliveryPhone: z.string().trim().min(1).max(30),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(30),
});

type CredentialSnapshot = {
  razorpay_key_id_snapshot: string | null;
  razorpay_key_secret_snapshot: string | null;
  razorpay_webhook_secret_snapshot: string | null;
};

async function createRazorpayOrder(orderId: string, total: number, credentials: RazorpayCredentials) {
  const basicAuth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(total * 100), currency: "INR", receipt: orderId.slice(0, 40), notes: { internal_order_id: orderId } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Razorpay could not prepare this payment.");
  return (await response.json()) as { id: string; amount: number; currency: string };
}

function credentialsFromSnapshot(snapshot: CredentialSnapshot) {
  return decryptRazorpayCredentials({
    razorpay_key_id: snapshot.razorpay_key_id_snapshot,
    razorpay_key_secret: snapshot.razorpay_key_secret_snapshot,
    razorpay_webhook_secret: snapshot.razorpay_webhook_secret_snapshot,
  });
}

function onlinePaymentError(error: CredentialConfigurationError) {
  if (error.message === "ONLINE_PAYMENT_UNAVAILABLE") {
    return NextResponse.json({ error: "ONLINE_PAYMENT_UNAVAILABLE", message: "This restaurant has not configured online payments yet." }, { status: 422 });
  }
  return NextResponse.json({ error: "ONLINE_PAYMENT_CONFIGURATION_ERROR", message: "Online payments are temporarily unavailable for this restaurant." }, { status: 503 });
}

export async function POST(request: NextRequest) {
  try {
    const input = checkoutSchema.parse(await request.json());
    const deliveryPhone = normalizeIndianPhone(input.deliveryPhone);
    if (!deliveryPhone) return NextResponse.json({ error: "Enter a valid 10-digit Indian delivery number." }, { status: 400 });
    const { supabase, user } = await requireUser();
    const existing = await supabase.from("orders").select("id,restaurant_id,status,payment_method,razorpay_order_id,total,razorpay_key_id_snapshot,razorpay_key_secret_snapshot,razorpay_webhook_secret_snapshot").eq("customer_id", user.id).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (existing.data.payment_method === "razorpay") {
        const credentials = credentialsFromSnapshot(existing.data);
        let razorpayOrderId = existing.data.razorpay_order_id;
        if (!razorpayOrderId) {
          const paymentOrder = await createRazorpayOrder(existing.data.id, Number(existing.data.total), credentials);
          razorpayOrderId = paymentOrder.id;
          const { error } = await getSupabaseAdminClient().from("orders").update({ razorpay_order_id: razorpayOrderId }).eq("id", existing.data.id);
          if (error) throw error;
        }
        return NextResponse.json({ orderId: existing.data.id, status: existing.data.status, paymentMethod: "razorpay", razorpayOrderId, razorpayKeyId: credentials.keyId, total: Number(existing.data.total), reused: true });
      }
      return NextResponse.json({ orderId: existing.data.id, status: existing.data.status, paymentMethod: "cod", total: Number(existing.data.total), reused: true });
    }

    const uniqueItemIds = [...new Set(input.lines.map((line) => line.itemId))];
    const { data: items, error: itemsError } = await supabase.from("menu_items").select("id,restaurant_id,name,price,active").eq("restaurant_id", input.restaurantId).in("id", uniqueItemIds);
    if (itemsError) throw itemsError;
    if (!items || items.length !== uniqueItemIds.length || items.some((item) => !item.active)) {
      return NextResponse.json({ error: "One or more items are no longer available." }, { status: 409 });
    }
    const itemById = new Map(items.map((item) => [item.id, item]));
    const lineSnapshots = input.lines.map((line) => {
      const item = itemById.get(line.itemId)!;
      const unitPrice = Number(item.price);
      return { item, quantity: line.quantity, unitPrice, lineTotal: Number((unitPrice * line.quantity).toFixed(2)) };
    });
    const subtotal = Number(lineSnapshots.reduce((total, line) => total + line.lineTotal, 0).toFixed(2));
    const quote = await createDeliveryQuote(supabase, user.id, input);
    if (!quote.withinDeliveryRadius) return NextResponse.json({ error: "This address is outside the restaurant's delivery radius." }, { status: 422 });

    const admin = getSupabaseAdminClient();
    const [{ data: restaurant, error: restaurantError }, { data: address, error: addressError }] = await Promise.all([
      admin.from("restaurants").select("id,name,slug,address_text,latitude,longitude,razorpay_key_id,razorpay_key_secret,razorpay_webhook_secret").eq("id", input.restaurantId).single(),
      admin.from("customer_addresses").select("id,address_text,latitude,longitude,label").eq("id", input.addressId).eq("customer_id", user.id).single(),
    ]);
    if (restaurantError) throw restaurantError;
    if (addressError) throw addressError;
    const credentials = input.paymentMethod === "razorpay" ? decryptRazorpayCredentials(restaurant) : null;
    const total = Number((subtotal + quote.fee).toFixed(2));
    const { razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, ...restaurantSnapshot } = restaurant;
    const { data: order, error: orderError } = await admin.from("orders").insert({
      restaurant_id: input.restaurantId,
      customer_id: user.id,
      address_id: input.addressId,
      status: input.paymentMethod === "cod" ? "pending_approval" : "pending_payment",
      payment_method: input.paymentMethod,
      payment_status: "pending",
      idempotency_key: input.idempotencyKey,
      subtotal,
      delivery_fee: quote.fee,
      total,
      route_distance_km: quote.distanceKm,
      route_duration_seconds: quote.durationSeconds,
      customer_address_snapshot: address,
      restaurant_snapshot: restaurantSnapshot,
      delivery_phone_ciphertext: encryptCustomerContact(deliveryPhone),
      delivery_phone_last4: lastFourDigits(deliveryPhone),
      razorpay_key_id_snapshot: credentials?.keyId ?? null,
      razorpay_key_secret_snapshot: credentials ? razorpay_key_secret : null,
      razorpay_webhook_secret_snapshot: credentials ? razorpay_webhook_secret : null,
      notes: input.notes || null,
    }).select("id,status").single();
    if (orderError) throw orderError;
    const { error: lineError } = await admin.from("order_items").insert(lineSnapshots.map((line) => ({ order_id: order.id, restaurant_id: input.restaurantId, menu_item_id: line.item.id, item_name: line.item.name, unit_price: line.unitPrice, quantity: line.quantity, line_total: line.lineTotal })));
    if (lineError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw lineError;
    }
    if (input.paymentMethod === "cod") return NextResponse.json({ orderId: order.id, status: order.status, total, paymentMethod: "cod" }, { status: 201 });

    const razorpayOrder = await createRazorpayOrder(order.id, total, credentials!);
    const { error: razorpayUpdateError } = await admin.from("orders").update({ razorpay_order_id: razorpayOrder.id }).eq("id", order.id);
    if (razorpayUpdateError) throw razorpayUpdateError;
    return NextResponse.json({ orderId: order.id, status: order.status, total, paymentMethod: "razorpay", razorpayOrderId: razorpayOrder.id, razorpayKeyId: credentials!.keyId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Your checkout details are incomplete." }, { status: 400 });
    if (error instanceof CredentialConfigurationError) return onlinePaymentError(error);
    if (error instanceof CustomerContactError) return NextResponse.json({ error: "DELIVERY_CONTACT_CONFIGURATION_ERROR", message: "Delivery contact saving is temporarily unavailable." }, { status: 503 });
    return apiError(error, "Checkout could not be completed.");
  }
}
