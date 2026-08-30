import { NextRequest, NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";
import { NOMINATIM_SEARCH_URL } from "@/lib/open-street-map";

type NominatimPlace = {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
};

let nextNominatimRequestAt = 0;

async function waitForNominatimSlot() {
  const now = Date.now();
  const requestAt = Math.max(now, nextNominatimRequestAt);
  nextNominatimRequestAt = requestAt + 1000;
  if (requestAt > now) await new Promise((resolve) => setTimeout(resolve, requestAt - now));
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query || query.length < 3) return NextResponse.json([]);

    const url = new URL(NOMINATIM_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "in");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "5");
    await waitForNominatimSlot();
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FastfoodDelivery/1.0 (OpenStreetMap address search)",
      },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error("OpenStreetMap address search failed.");
    const places = (await response.json()) as NominatimPlace[];
    return NextResponse.json(places.flatMap((place) => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{ id: String(place.place_id), addressText: place.display_name, latitude, longitude }];
    }));
  } catch (error) { return apiError(error, "Address suggestions could not be loaded."); }
}
