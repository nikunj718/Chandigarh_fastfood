import { NextRequest, NextResponse } from "next/server";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { foodImageExtension, MAX_FOOD_IMAGE_BYTES } from "@/lib/menu-media";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ restaurantId: string; itemId: string }> }) {
  try {
    const { restaurantId, itemId } = await context.params;
    const { supabase } = await requireRestaurantManager(restaurantId);
    const { data: item, error: itemError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new Error("NOT_FOUND");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a JPEG, PNG, or WebP food photo." }, { status: 400 });
    const extension = foodImageExtension(file.type);
    if (!extension) return NextResponse.json({ error: "Food photos must be JPEG, PNG, or WebP files." }, { status: 400 });
    if (!file.size || file.size > MAX_FOOD_IMAGE_BYTES) return NextResponse.json({ error: "Food photos must be 5 MB or smaller." }, { status: 400 });

    const storage = getSupabaseAdminClient().storage.from("restaurant-food-images");
    const objectPath = `${restaurantId}/${itemId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await storage.upload(objectPath, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = storage.getPublicUrl(objectPath);
    const { data: updated, error: updateError } = await supabase
      .from("menu_items")
      .update({ image_url: publicUrl.publicUrl })
      .eq("id", itemId)
      .eq("restaurant_id", restaurantId)
      .select("*")
      .maybeSingle();
    if (updateError || !updated) {
      await storage.remove([objectPath]);
      if (updateError) throw updateError;
      throw new Error("NOT_FOUND");
    }
    return NextResponse.json({ item: updated });
  } catch (error) {
    return apiError(error, "The food photo could not be uploaded.");
  }
}
