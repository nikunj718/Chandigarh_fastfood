import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const querySchema = z.object({ restaurantId: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    const { restaurantId } = querySchema.parse({ restaurantId: request.nextUrl.searchParams.get("restaurantId") });
    const admin = getSupabaseAdminClient();
    const [{ data: restaurant, error: restaurantError }, { data, error }] = await Promise.all([
      admin.from("restaurants").select("id").eq("id", restaurantId).eq("active", true).maybeSingle(),
      admin
      .from("menu_categories")
      .select("id,restaurant_id,name,description,sort_order,menu_items(id,restaurant_id,category_id,name,description,price,image_url,vegetarian,active,sort_order)")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .order("sort_order"),
    ]);
    if (restaurantError) throw restaurantError;
    if (!restaurant) return NextResponse.json({ error: "This restaurant is unavailable." }, { status: 404 });
    if (error) throw error;
    const categories = (data ?? []).map((category) => ({
      ...category,
      items: (category.menu_items ?? []).filter((item: { active: boolean }) => item.active).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order).map((item: Record<string, unknown>) => ({ ...item, price: Number(item.price) })),
      menu_items: undefined,
    }));
    return NextResponse.json(categories);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "A restaurant ID is required." }, { status: 400 });
    return apiError(error, "Menu items could not be loaded.");
  }
}
