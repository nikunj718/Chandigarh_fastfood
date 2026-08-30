import { z } from "zod";
import { calculateDeliveryFee, haversineKm } from "@/lib/geospatial";
import type { DeliveryQuote } from "@/lib/types";

export const quoteRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  addressId: z.string().uuid(),
});

type Coordinate = { latitude: number; longitude: number };
export type RouteGeometry = { type: "LineString"; coordinates: Array<[number, number]> };

export function estimateDeliveryRoute(from: Coordinate, to: Coordinate) {
  const directDistanceKm = haversineKm(from, to);
  // A modest road-distance multiplier produces a safer delivery-radius and fee estimate
  // without contacting any commercial routing service.
  const distanceKm = Number((directDistanceKm * 1.25).toFixed(3));
  const durationSeconds = Math.max(60, Math.round((distanceKm / 20) * 60 * 60));
  const geometry: RouteGeometry = { type: "LineString", coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] };
  return {
    distanceKm,
    durationSeconds,
    geometry,
  };
}

export async function createDeliveryQuote(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").getSupabaseServerClient>>, userId: string, input: z.infer<typeof quoteRequestSchema>): Promise<DeliveryQuote & { geometry: RouteGeometry }> {
  const [{ data: restaurant, error: restaurantError }, { data: address, error: addressError }] = await Promise.all([
    supabase.from("restaurants").select("id, latitude, longitude, delivery_fee_base, delivery_fee_per_km, delivery_radius_km, active").eq("id", input.restaurantId).maybeSingle(),
    supabase.from("customer_addresses").select("id, customer_id, latitude, longitude").eq("id", input.addressId).maybeSingle(),
  ]);
  if (restaurantError) throw restaurantError;
  if (addressError) throw addressError;
  if (!restaurant?.active) throw new Error("This restaurant is unavailable.");
  if (!address || address.customer_id !== userId) throw new Error("The selected address is unavailable.");
  const route = estimateDeliveryRoute(restaurant, address);
  const withinDeliveryRadius = route.distanceKm <= Number(restaurant.delivery_radius_km);
  return {
    restaurantId: input.restaurantId,
    addressId: input.addressId,
    distanceKm: route.distanceKm,
    durationSeconds: route.durationSeconds,
    fee: calculateDeliveryFee(Number(restaurant.delivery_fee_base), Number(restaurant.delivery_fee_per_km), route.distanceKm),
    withinDeliveryRadius,
    geometry: route.geometry,
  };
}
