import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";
import { haversineKm } from "@/lib/geospatial";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const restaurantSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  addressText: z.string().trim().min(3).max(300),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

function numericRestaurant(row: Record<string, unknown>) {
  return {
    ...row,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    delivery_fee_base: Number(row.delivery_fee_base),
    delivery_fee_per_km: Number(row.delivery_fee_per_km),
    delivery_radius_km: Number(row.delivery_radius_km),
  };
}

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug");
    const addressId = request.nextUrl.searchParams.get("addressId");
    const admin = getSupabaseAdminClient();
    let query = admin.from("restaurants").select("id,name,slug,owner_name,description,phone,address_text,latitude,longitude,delivery_fee_base,delivery_fee_per_km,delivery_radius_km,active").eq("active", true).order("name");
    if (slug) query = query.eq("slug", slug);
    const { data: restaurants, error } = await query;
    if (error) throw error;

    let address: { latitude: number; longitude: number } | null = null;
    if (addressId) {
      const { supabase, user } = await requireUser();
      const { data, error: addressError } = await supabase.from("customer_addresses").select("latitude,longitude").eq("id", addressId).eq("customer_id", user.id).maybeSingle();
      if (addressError) throw addressError;
      address = data ? { latitude: Number(data.latitude), longitude: Number(data.longitude) } : null;
    }
    const payload = (restaurants ?? []).map((restaurant) => {
      const parsed = numericRestaurant(restaurant as Record<string, unknown>);
      return { ...parsed, approximateDistanceKm: address ? haversineKm(address, parsed) : null };
    });
    return NextResponse.json(slug ? payload[0] ?? null : payload);
  } catch (error) {
    return apiError(error, "Restaurants could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = restaurantSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    const ownerEmail = user.email?.trim().toLowerCase();
    if (!ownerEmail) throw new Error("EMAIL_CONFIRMATION_REQUIRED");
    const { data, error } = await supabase.from("restaurants").insert({
      created_by: user.id,
      name: body.name,
      slug: body.slug,
      owner_name: body.ownerName,
      owner_email: ownerEmail,
      description: body.description ?? null,
      phone: body.phone ?? null,
      address_text: body.addressText,
      latitude: body.latitude,
      longitude: body.longitude,
    }).select("id,name,slug,owner_name,owner_email").single();
    if (error) throw error;
    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", data.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || membership.role !== "owner") {
      throw new Error("The restaurant owner membership could not be verified.");
    }
    const { error: profileError } = await supabase.from("profiles").update({ display_name: body.ownerName }).eq("id", user.id);
    if (profileError) throw profileError;
    return NextResponse.json({ ...data, membershipRole: membership.role }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check your restaurant details and try again." }, { status: 400 });
    return apiError(error, "The restaurant could not be created.");
  }
}
