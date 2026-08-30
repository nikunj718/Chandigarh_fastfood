import { NextResponse } from "next/server";
import { isVerifiedUser } from "@/lib/identity";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export { isVerifiedUser } from "@/lib/identity";

export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHORIZED");
  if (!isVerifiedUser(data.user)) throw new Error("EMAIL_CONFIRMATION_REQUIRED");
  return { supabase, user: data.user };
}

export function apiError(error: unknown, fallback = "Request could not be completed") {
  const message = error instanceof Error ? error.message : fallback;
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (message === "EMAIL_CONFIRMATION_REQUIRED") return NextResponse.json({ error: "Confirm your email address before using this feature." }, { status: 403 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "You do not have access to this restaurant." }, { status: 403 });
  if (message === "NOT_FOUND") return NextResponse.json({ error: "The requested record was not found." }, { status: 404 });
  if (message.includes("not configured") || message.includes("Missing server configuration") || message.includes("encryption is not configured")) {
    return NextResponse.json({ error: "This feature has not been configured yet." }, { status: 503 });
  }
  console.error("API request failed", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function requireRestaurantManager(restaurantId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("FORBIDDEN");
  return { supabase, user, membership: data };
}
