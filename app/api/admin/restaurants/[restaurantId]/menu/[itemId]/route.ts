import { NextResponse } from "next/server";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { foodImageObjectPath } from "@/lib/menu-media";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, context: { params: Promise<{ restaurantId: string; itemId: string }> }) {
  try {
    const { restaurantId, itemId } = await context.params;
    const { supabase } = await requireRestaurantManager(restaurantId);
    const { data: item, error: itemError } = await supabase
      .from("menu_items")
      .select("image_url")
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("NOT_FOUND");

    const { error: deleteError } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId);
    if (deleteError) throw deleteError;

    const objectPath = foodImageObjectPath(item.image_url, restaurantId, itemId);
    if (objectPath) {
      const { error: storageError } = await getSupabaseAdminClient().storage.from("restaurant-food-images").remove([objectPath]);
      if (storageError) {
        console.warn("Food image cleanup failed after menu item deletion", { restaurantId, itemId, code: storageError.name });
      }
    }
    return NextResponse.json({ id: itemId });
  } catch (error) {
    return apiError(error, "The menu item could not be deleted.");
  }
}
