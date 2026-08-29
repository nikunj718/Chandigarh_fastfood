import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";

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
});

export async function GET(_request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const { supabase } = await requireRestaurantManager(restaurantId);
    const [restaurant, categories, orders, members] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", restaurantId).single(),
      supabase.from("menu_categories").select("*,menu_items(*)").eq("restaurant_id", restaurantId).order("sort_order"),
      supabase.from("orders").select("id,status,payment_method,payment_status,total,created_at,delivery_assignments(rider_id)").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(30),
      supabase.from("restaurant_memberships").select("user_id,role,profiles(display_name,phone)").eq("restaurant_id", restaurantId),
    ]);
    if (restaurant.error) throw restaurant.error;
    if (categories.error) throw categories.error;
    if (orders.error) throw orders.error;
    if (members.error) throw members.error;
    return NextResponse.json({ restaurant: restaurant.data, categories: categories.data, orders: orders.data, members: members.data });
  } catch (error) { return apiError(error, "Restaurant operations could not be loaded."); }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const body = settingsSchema.parse(await request.json());
    const { supabase } = await requireRestaurantManager(restaurantId);
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
    };
    const { data, error } = await supabase.from("restaurants").update(payload).eq("id", restaurantId).select("*").single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the restaurant settings and try again." }, { status: 400 });
    return apiError(error, "Restaurant settings could not be saved.");
  }
}
