import type { SupabaseClient, User } from "@supabase/supabase-js";
import { hasSupabaseConfig } from "@/lib/env";
import { isVerifiedUser } from "@/lib/identity";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ManagedRestaurant = {
  id: string;
  name: string;
  slug: string;
  addressText: string | null;
  active: boolean;
  role: "owner" | "manager";
};

type MembershipRow = {
  restaurant_id: string;
  role: "owner" | "manager";
  restaurants: {
    id: string;
    name: string;
    slug: string;
    address_text: string | null;
    active: boolean;
  }[] | null;
};

export function managementDestination(restaurants: Pick<ManagedRestaurant, "id">[]) {
  if (restaurants.length === 0) return "/restaurants";
  if (restaurants.length === 1) return `/admin/${restaurants[0].id}`;
  return "/admin";
}

export function hasRestaurantOwnerAccess(memberships: Array<{ role: string }>) {
  return memberships.some((membership) => membership.role === "owner");
}

export async function getManagedRestaurants(supabase: SupabaseClient, userId: string): Promise<ManagedRestaurant[]> {
  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,role,restaurants(id,name,slug,address_text,active)")
    .eq("user_id", userId)
    .in("role", ["owner", "manager"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as MembershipRow[])
    .flatMap((membership) => {
      const restaurant = membership.restaurants?.[0];
      return restaurant ? [{
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        addressText: restaurant.address_text,
        active: restaurant.active,
        role: membership.role,
      }] : [];
    });
}

export async function getAuthenticatedLandingForUser(supabase: SupabaseClient, user: User) {
  return managementDestination(await getManagedRestaurants(supabase, user.id));
}

export async function getOptionalSessionLanding() {
  if (!hasSupabaseConfig()) return null;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isVerifiedUser(data.user)) return null;
  return getAuthenticatedLandingForUser(supabase, data.user);
}
