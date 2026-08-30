import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { encryptCredential, hasCompleteRazorpayCredentials, maskRazorpayKeyId } from "@/lib/restaurant-credentials";
import { decryptCustomerContact } from "@/lib/customer-contact";
import { normalizeOperatingHours, operatingHoursSchema } from "@/lib/operating-hours";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const credentialFields = ["razorpayKeyId", "razorpayKeySecret", "razorpayWebhookSecret"] as const;
const credentialSchema = z.object({
  razorpayKeyId: z.string().trim().min(3).max(100).optional(),
  razorpayKeySecret: z.string().trim().min(8).max(500).optional(),
  razorpayWebhookSecret: z.string().trim().min(8).max(500).optional(),
  clearRazorpayCredentials: z.boolean().optional().default(false),
});

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  addressText: z.string().trim().min(3).max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryFeeBase: z.number().min(0).max(9999).optional(),
  deliveryFeePerKm: z.number().min(0).max(9999).optional(),
  deliveryRadiusKm: z.number().min(0.1).max(100).optional(),
  active: z.boolean().optional(),
  operatingHours: operatingHoursSchema.optional(),
}).merge(credentialSchema).superRefine((value, context) => {
  const supplied = credentialFields.filter((field) => Boolean(value[field]));
  if (value.clearRazorpayCredentials && supplied.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Clear credentials separately from adding new credentials." });
  }
  if (supplied.length > 0 && supplied.length !== credentialFields.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Provide the Key ID, Key Secret, and Webhook Secret together." });
  }
});

const restaurantColumns = "id,created_by,name,slug,owner_name,owner_email,description,phone,address_text,latitude,longitude,delivery_fee_base,delivery_fee_per_km,delivery_radius_km,active,created_at,updated_at,razorpay_key_id,razorpay_key_secret,razorpay_webhook_secret";

function safeRestaurantForAdmin(restaurant: Record<string, unknown>) {
  const { razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, ...safeRestaurant } = restaurant;
  return {
    ...safeRestaurant,
    razorpayConfigured: hasCompleteRazorpayCredentials({
      razorpay_key_id: typeof razorpay_key_id === "string" ? razorpay_key_id : null,
      razorpay_key_secret: typeof razorpay_key_secret === "string" ? razorpay_key_secret : null,
      razorpay_webhook_secret: typeof razorpay_webhook_secret === "string" ? razorpay_webhook_secret : null,
    }),
    razorpayKeyIdHint: maskRazorpayKeyId(typeof razorpay_key_id === "string" ? razorpay_key_id : null),
  };
}

function credentialPayload(body: z.infer<typeof settingsSchema>) {
  if (body.clearRazorpayCredentials) {
    return { razorpay_key_id: null, razorpay_key_secret: null, razorpay_webhook_secret: null };
  }
  if (!body.razorpayKeyId) return {};
  return {
    razorpay_key_id: body.razorpayKeyId,
    razorpay_key_secret: encryptCredential(body.razorpayKeySecret!),
    razorpay_webhook_secret: encryptCredential(body.razorpayWebhookSecret!),
  };
}

function safeOrderForAdmin(order: Record<string, unknown>) {
  const { delivery_phone_ciphertext, ...safeOrder } = order;
  return {
    ...safeOrder,
    deliveryPhone: typeof delivery_phone_ciphertext === "string" ? decryptCustomerContact(delivery_phone_ciphertext) : null,
  };
}

class OperationsDataError extends Error {
  constructor(readonly stage: string, readonly databaseError: unknown) {
    super(`Operations data query failed: ${stage}`);
    this.name = "OperationsDataError";
  }
}

function requireQuerySuccess(stage: string, error: unknown) {
  if (error) throw new OperationsDataError(stage, error);
}

function logOperationsLoadFailure(restaurantId: string | null, error: unknown) {
  if (error instanceof OperationsDataError) {
    const databaseError = error.databaseError as { code?: string; message?: string; details?: string; hint?: string } | null;
    console.error("Admin restaurant operations database query failed", {
      restaurantId,
      stage: error.stage,
      code: databaseError?.code,
      message: databaseError?.message,
      details: databaseError?.details,
      hint: databaseError?.hint,
    });
    return;
  }
  console.error("Admin restaurant operations request failed", { restaurantId, error });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  let restaurantId: string | null = null;
  try {
    ({ restaurantId } = await context.params);
    const { supabase, user, membership } = await requireRestaurantManager(restaurantId);
    const [restaurant, categories, orders, members, hours, profile] = await Promise.all([
      supabase.from("restaurants").select(restaurantColumns).eq("id", restaurantId).maybeSingle(),
      supabase.from("menu_categories").select("*,menu_items(*)").eq("restaurant_id", restaurantId).order("sort_order"),
      supabase.from("orders").select("id,status,payment_method,payment_status,total,created_at,delivery_phone_ciphertext,delivery_phone_last4,delivery_assignments(rider_id)").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(30),
      supabase.from("restaurant_memberships").select("user_id,role").eq("restaurant_id", restaurantId),
      supabase.from("restaurant_operating_hours").select("day_of_week,is_closed,opens_at,closes_at").eq("restaurant_id", restaurantId).order("day_of_week"),
      supabase.from("profiles").select("email_verified").eq("id", user.id).maybeSingle(),
    ]);
    requireQuerySuccess("restaurant", restaurant.error);
    requireQuerySuccess("menu categories", categories.error);
    requireQuerySuccess("orders", orders.error);
    requireQuerySuccess("restaurant memberships", members.error);
    requireQuerySuccess("operating hours", hours.error);
    requireQuerySuccess("owner profile", profile.error);
    if (!restaurant.data) throw new Error("NOT_FOUND");

    const memberIds = (members.data ?? []).map((member) => member.user_id);
    const memberProfiles = memberIds.length
      ? await supabase.from("profiles").select("id,display_name,email").in("id", memberIds)
      : { data: [], error: null };
    requireQuerySuccess("member profiles", memberProfiles.error);
    const profilesById = new Map((memberProfiles.data ?? []).map((memberProfile) => [memberProfile.id, memberProfile]));
    const teamMembers = (members.data ?? []).map((member) => ({
      ...member,
      profiles: profilesById.get(member.user_id) ?? null,
    }));

    return NextResponse.json({
      restaurant: safeRestaurantForAdmin(restaurant.data as Record<string, unknown>),
      categories: categories.data ?? [],
      orders: (orders.data ?? []).map((order) => safeOrderForAdmin(order as Record<string, unknown>)),
      members: teamMembers,
      membershipRole: membership.role,
      operatingHours: normalizeOperatingHours(hours.data),
      ownerAccountNeedsSecurity: membership.role === "owner" && !profile.data?.email_verified,
    });
  } catch (error) {
    logOperationsLoadFailure(restaurantId, error);
    return apiError(error, "Restaurant operations could not be loaded.");
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const body = settingsSchema.parse(await request.json());
    const { membership } = await requireRestaurantManager(restaurantId);
    const hasCredentialUpdate = body.clearRazorpayCredentials || Boolean(body.razorpayKeyId);
    if (hasCredentialUpdate && membership.role !== "owner") throw new Error("FORBIDDEN");
    const payload = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.addressText !== undefined ? { address_text: body.addressText } : {}),
      ...(body.latitude !== undefined ? { latitude: body.latitude } : {}),
      ...(body.longitude !== undefined ? { longitude: body.longitude } : {}),
      ...(body.deliveryFeeBase !== undefined ? { delivery_fee_base: body.deliveryFeeBase } : {}),
      ...(body.deliveryFeePerKm !== undefined ? { delivery_fee_per_km: body.deliveryFeePerKm } : {}),
      ...(body.deliveryRadiusKm !== undefined ? { delivery_radius_km: body.deliveryRadiusKm } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...credentialPayload(body),
    };
    const admin = getSupabaseAdminClient();
    const restaurantQuery = Object.keys(payload).length
      ? admin.from("restaurants").update(payload).eq("id", restaurantId).select(restaurantColumns).single()
      : admin.from("restaurants").select(restaurantColumns).eq("id", restaurantId).single();
    const { data, error } = await restaurantQuery;
    if (error) throw error;
    if (body.operatingHours) {
      const { error: hoursError } = await admin.from("restaurant_operating_hours").upsert(
        body.operatingHours.map((hour) => ({
          restaurant_id: restaurantId,
          day_of_week: hour.dayOfWeek,
          is_closed: hour.isClosed,
          opens_at: hour.isClosed ? null : hour.opensAt,
          closes_at: hour.isClosed ? null : hour.closesAt,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "restaurant_id,day_of_week" },
      );
      if (hoursError) throw hoursError;
    }
    const { data: hours, error: hoursError } = await admin.from("restaurant_operating_hours").select("day_of_week,is_closed,opens_at,closes_at").eq("restaurant_id", restaurantId).order("day_of_week");
    if (hoursError) throw hoursError;
    return NextResponse.json({ restaurant: safeRestaurantForAdmin(data as Record<string, unknown>), operatingHours: normalizeOperatingHours(hours) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the restaurant settings and try again." }, { status: 400 });
    return apiError(error, "Restaurant settings could not be saved.");
  }
}
