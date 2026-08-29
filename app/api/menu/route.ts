import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";

const querySchema = z.object({ restaurantId: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    const { restaurantId } = querySchema.parse({ restaurantId: request.nextUrl.searchParams.get("restaurantId") });
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("menu_categories")
      .select("id,restaurant_id,name,description,sort_order,menu_items(id,restaurant_id,category_id,name,description,price,image_url,vegetarian,active,sort_order)")
      .eq("restaurant_id", restaurantId)
      .eq("active", true)
      .order("sort_order");
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
