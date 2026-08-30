import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const memberSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320), role: z.enum(["manager", "rider"]) });

export async function POST(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const body = memberSchema.parse(await request.json());
    const { membership } = await requireRestaurantManager(restaurantId);
    if (membership.role !== "owner") return NextResponse.json({ error: "Only restaurant owners can add team members." }, { status: 403 });
    const admin = getSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from("profiles").select("id,display_name,email,email_verified").eq("email", body.email).eq("email_verified", true).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json({ error: "That staff member must confirm their email before being added." }, { status: 404 });
    const { data, error } = await admin.from("restaurant_memberships").upsert({ restaurant_id: restaurantId, user_id: profile.id, role: body.role }, { onConflict: "restaurant_id,user_id" }).select("user_id,role").single();
    if (error) throw error;
    return NextResponse.json({ ...data, profile });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Choose a valid role and confirmed email address." }, { status: 400 });
    return apiError(error, "Team member could not be added.");
  }
}
