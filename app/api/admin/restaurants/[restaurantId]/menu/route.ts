import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("category"), name: z.string().trim().min(1).max(60), description: z.string().trim().max(200).optional() }),
  z.object({ kind: z.literal("item"), categoryId: z.string().uuid(), name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(), price: z.number().min(0).max(99999), vegetarian: z.boolean().default(true) }),
]);

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable(),
  price: z.number().min(0).max(99999),
  vegetarian: z.boolean(),
  active: z.boolean(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const body = createSchema.parse(await request.json());
    const { supabase } = await requireRestaurantManager(restaurantId);
    if (body.kind === "category") {
      const { data, error } = await supabase.from("menu_categories").insert({ restaurant_id: restaurantId, name: body.name, description: body.description ?? null }).select("*").single();
      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
    const { data: category, error: categoryError } = await supabase.from("menu_categories").select("id").eq("id", body.categoryId).eq("restaurant_id", restaurantId).maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) return NextResponse.json({ error: "Choose a category from this restaurant." }, { status: 400 });
    const { data, error } = await supabase.from("menu_items").insert({ restaurant_id: restaurantId, category_id: body.categoryId, name: body.name, description: body.description ?? null, price: body.price, vegetarian: body.vegetarian }).select("*").single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the menu fields and try again." }, { status: 400 });
    return apiError(error, "The menu update could not be saved.");
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const body = updateItemSchema.parse(await request.json());
    const { supabase } = await requireRestaurantManager(restaurantId);
    if (body.categoryId) {
      const { data: category, error: categoryError } = await supabase
        .from("menu_categories")
        .select("id")
        .eq("id", body.categoryId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) return NextResponse.json({ error: "Choose a category from this restaurant." }, { status: 400 });
    }
    const { data, error } = await supabase.from("menu_items").update({
      ...(body.categoryId ? { category_id: body.categoryId } : {}),
      name: body.name,
      description: body.description,
      price: body.price,
      vegetarian: body.vegetarian,
      active: body.active,
    }).eq("id", body.itemId).eq("restaurant_id", restaurantId).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("NOT_FOUND");
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the menu item fields and try again." }, { status: 400 });
    return apiError(error, "The menu item could not be saved.");
  }
}
