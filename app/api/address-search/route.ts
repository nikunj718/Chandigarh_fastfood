import { NextRequest, NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";
import { assertServerEnv, env } from "@/lib/env";

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query || query.length < 3) return NextResponse.json([]);
    assertServerEnv("mapboxSecretToken");
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
    url.searchParams.set("access_token", env.mapboxSecretToken!);
    url.searchParams.set("country", "in");
    url.searchParams.set("limit", "5");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Mapbox address search failed.");
    const payload = (await response.json()) as { features: Array<{ id: string; place_name: string; center: [number, number] }> };
    return NextResponse.json(payload.features.map((feature) => ({ id: feature.id, addressText: feature.place_name, longitude: feature.center[0], latitude: feature.center[1] })));
  } catch (error) { return apiError(error, "Address suggestions could not be loaded."); }
}
