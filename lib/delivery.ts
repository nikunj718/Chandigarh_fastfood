import { z } from "zod";
import { calculateDeliveryFee } from "@/lib/geospatial";
import { assertServerEnv, env } from "@/lib/env";
import type { DeliveryQuote } from "@/lib/types";

export const quoteRequestSchema = z.object({
  restaurantId: z.string().uuid(),
  addressId: z.string().uuid(),
});

type Coordinate = { latitude: number; longitude: number };

export async function fetchDrivingRoute(from: Coordinate, to: Coordinate) {
  assertServerEnv("mapboxSecretToken");
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?overview=full&geometries=geojson`, {
    headers: { Authorization: `Bearer ${env.mapboxSecretToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Mapbox Directions could not calculate this route.");
  const payload = (await response.json()) as { routes?: Array<{ distance: number; duration: number; geometry: GeoJSON.LineString }> };
  const route = payload.routes?.[0];
  if (!route) throw new Error("No driving route is available for this address.");
  return { distanceKm: Number((route.distance / 1000).toFixed(3)), durationSeconds: Math.round(route.duration), geometry: route.geometry };
}

export async function createDeliveryQuote(supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").getSupabaseServerClient>>, userId: string, input: z.infer<typeof quoteRequestSchema>): Promise<DeliveryQuote & { geometry: GeoJSON.LineString }> {
  const [{ data: restaurant, error: restaurantError }, { data: address, error: addressError }] = await Promise.all([
    supabase.from("restaurants").select("id, latitude, longitude, delivery_fee_base, delivery_fee_per_km, delivery_radius_km, active").eq("id", input.restaurantId).maybeSingle(),
    supabase.from("customer_addresses").select("id, customer_id, latitude, longitude").eq("id", input.addressId).maybeSingle(),
  ]);
  if (restaurantError) throw restaurantError;
  if (addressError) throw addressError;
  if (!restaurant?.active) throw new Error("This restaurant is unavailable.");
  if (!address || address.customer_id !== userId) throw new Error("The selected address is unavailable.");
  const route = await fetchDrivingRoute(restaurant, address);
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
