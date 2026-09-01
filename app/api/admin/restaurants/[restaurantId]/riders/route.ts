import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const riderSchema = z.object({ email: z.string().trim().toLowerCase().email().max(320) });

function riderPayload(member: { user_id: string; created_at: string }, profile?: { display_name: string | null; email: string | null; email_verified: boolean | null } | null) {
  return {
    userId: member.user_id,
    addedAt: member.created_at,
    displayName: profile?.display_name ?? null,
    email: profile?.email ?? null,
    active: Boolean(profile?.email_verified),
  };
}

async function requireRestaurantOwner(restaurantId: string) {
  const access = await requireRestaurantManager(restaurantId);
  if (access.membership.role !== "owner") throw new Error("FORBIDDEN");
  return access;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    await requireRestaurantOwner(restaurantId);
    const admin = getSupabaseAdminClient();
    const { data: memberships, error: membershipsError } = await admin
      .from("restaurant_memberships")
      .select("user_id,created_at")
      .eq("restaurant_id", restaurantId)
      .eq("role", "rider")
      .order("created_at", { ascending: false });
    if (membershipsError) throw membershipsError;
    const ids = (memberships ?? []).map((membership) => membership.user_id);
    const { data: profiles, error: profilesError } = ids.length
      ? await admin.from("profiles").select("id,display_name,email,email_verified").in("id", ids)
      : { data: [], error: null };
    if (profilesError) throw profilesError;
    const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return NextResponse.json({ riders: (memberships ?? []).map((membership) => riderPayload(membership, profilesById.get(membership.user_id))) });
  } catch (error) { return apiError(error, "Riders could not be loaded."); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const { email } = riderSchema.parse(await request.json());
    await requireRestaurantOwner(restaurantId);
    const admin = getSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,display_name,email,email_verified")
      .eq("email", email)
      .maybeSingle();
    if (profileError) throw profileError;

    if (profile?.email_verified) {
      const { data: membership, error: membershipError } = await admin
        .from("restaurant_memberships")
        .upsert({ restaurant_id: restaurantId, user_id: profile.id, role: "rider" }, { onConflict: "restaurant_id,user_id" })
        .select("user_id,created_at")
        .single();
      if (membershipError) throw membershipError;
      return NextResponse.json({ rider: riderPayload(membership, profile), invitationSent: false });
    }

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: authCallbackUrl(request.nextUrl.origin, "/rider"),
    });
    if (inviteError || !invite.user) {
      return NextResponse.json({ error: inviteError?.message ?? "The invitation could not be created." }, { status: 422 });
    }
    const { data: membership, error: membershipError } = await admin
      .from("restaurant_memberships")
      .upsert({ restaurant_id: restaurantId, user_id: invite.user.id, role: "rider" }, { onConflict: "restaurant_id,user_id" })
      .select("user_id,created_at")
      .single();
    if (membershipError) throw membershipError;
    const invitedProfile = profile ?? {
      display_name: invite.user.user_metadata?.full_name ?? null,
      email: invite.user.email ?? email,
      email_verified: Boolean(invite.user.email_confirmed_at),
    };
    return NextResponse.json({ rider: riderPayload(membership, invitedProfile), invitationSent: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid rider email address." }, { status: 400 });
    return apiError(error, "Rider invitation could not be sent.");
  }
}
