"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, MapPin, Navigation, Store, Truck, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
import { OPEN_STREET_MAP_ATTRIBUTION, OPEN_STREET_MAP_TILE_URL } from "@/lib/open-street-map";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import type { RouteGeometry } from "@/lib/delivery";

type TrackingData = {
  orderId: string;
  status: string;
  paymentStatus: string;
  restaurant: { name: string; latitude: number; longitude: number; address_text?: string };
  customerAddress: { address_text: string; latitude: number; longitude: number };
  rider: { latitude: number; longitude: number; recordedAt: string } | null;
  riderAssigned: boolean;
  etaSeconds: number | null;
  route: RouteGeometry | null;
};

const labels: Record<string, string> = { pending_payment: "Awaiting payment", pending_approval: "Awaiting restaurant approval", confirmed: "Order confirmed", preparing: "Being prepared", out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled" };

function updatePointMarker(L: any, map: any, marker: any, point: [number, number], color: string, label: string) {
  if (marker) { marker.setLatLng(point); return marker; }
  return L.circleMarker(point, { radius: 9, color: "#ffffff", weight: 3, fillColor: color, fillOpacity: 1 }).bindTooltip(label, { direction: "top", offset: [0, -8] }).addTo(map);
}

export function TrackingExperience({ orderId }: { orderId: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markers = useRef<{ restaurant?: any; customer?: any; rider?: any }>({});
  const routeLine = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/orders/${orderId}/tracking`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Tracking data could not be loaded.");
    setTracking(payload);
  }, [orderId]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Tracking data could not be loaded.")); }, [load]);

  useEffect(() => {
    let disposed = false;
    let currentMap: any = null;
    const initialise = async () => {
      const module = await import("leaflet");
      const L = module.default;
      if (disposed || !mapContainer.current) return;
      currentMap = L.map(mapContainer.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
      L.tileLayer(OPEN_STREET_MAP_TILE_URL, { attribution: OPEN_STREET_MAP_ATTRIBUTION, maxZoom: 19 }).addTo(currentMap);
      mapRef.current = currentMap;
      leafletRef.current = L;
      setMapReady(true);
    };
    void initialise().catch(() => setMapError("The tracking map could not be loaded. Order status remains available."));
    return () => {
      disposed = true;
      currentMap?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      markers.current = {};
      routeLine.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !tracking || !mapReady) return;
    const restaurantPoint: [number, number] = [tracking.restaurant.latitude, tracking.restaurant.longitude];
    const customerPoint: [number, number] = [tracking.customerAddress.latitude, tracking.customerAddress.longitude];
    markers.current.restaurant = updatePointMarker(L, map, markers.current.restaurant, restaurantPoint, "#dc6b20", tracking.restaurant.name);
    markers.current.customer = updatePointMarker(L, map, markers.current.customer, customerPoint, "#506b48", "Delivery address");
    const displayedPoints: [number, number][] = [restaurantPoint, customerPoint];
    if (tracking.rider) {
      const riderPoint: [number, number] = [tracking.rider.latitude, tracking.rider.longitude];
      markers.current.rider = updatePointMarker(L, map, markers.current.rider, riderPoint, "#221711", "Rider");
      displayedPoints.push(riderPoint);
    } else if (markers.current.rider) {
      markers.current.rider.remove();
      markers.current.rider = undefined;
    }
    const route: Array<[number, number]> = tracking.route?.coordinates ?? [[restaurantPoint[1], restaurantPoint[0]], [customerPoint[1], customerPoint[0]]];
    const routePoints = route.map((point) => [Number(point[1]), Number(point[0])]);
    if (routeLine.current) routeLine.current.setLatLngs(routePoints);
    else routeLine.current = L.polyline(routePoints, { color: "#dc6b20", weight: 5, opacity: 0.75 }).addTo(map);
    map.fitBounds(L.latLngBounds(displayedPoints), { padding: [70, 70], maxZoom: 14, animate: true });
  }, [mapReady, tracking]);

  useEffect(() => {
    if (!env.supabaseUrl || !env.supabaseAnonKey) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`delivery-${orderId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_location_points", filter: `order_id=eq.${orderId}` }, () => { void load().catch(() => setError("Live location briefly disconnected. Retrying…")); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, orderId]);

  const eta = tracking?.etaSeconds ? `${Math.max(1, Math.ceil(tracking.etaSeconds / 60))} min estimate` : "Calculating";
  const steps: Array<{ status: string; Icon: LucideIcon; text: string }> = [
    { status: "confirmed", Icon: CheckCircle2, text: "Restaurant confirmed" },
    { status: "preparing", Icon: Store, text: "Freshly preparing your order" },
    { status: "out_for_delivery", Icon: Truck, text: "Rider is on the way" },
    { status: "delivered", Icon: MapPin, text: "Delivered to your door" },
  ];
  return <main className="min-h-screen bg-cream"><header className="border-b border-orange-100 bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/restaurants" className="font-bold">Fastfood Delivery</Link><span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-saffron">Live delivery</span></div></header><section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[360px_1fr]"><Card className="order-2 p-6 lg:order-1"><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Order tracking</p><h1 className="display-font mt-2 text-3xl">{tracking ? labels[tracking.status] ?? tracking.status : "Finding your order"}</h1>{error && <div className="mt-5"><StatusNote tone="error">{error}</StatusNote></div>}{tracking && <><div className="mt-7 rounded-2xl bg-orange-50 p-4"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-saffron" /><div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">Current ETA</p><p className="text-xl font-bold">{eta}</p></div></div></div><ol className="mt-7 space-y-5 border-l border-orange-200 pl-5">{steps.map((step) => { const order = ["pending_payment", "pending_approval", "confirmed", "preparing", "out_for_delivery", "delivered"].indexOf(tracking.status); const done = order >= ["confirmed", "preparing", "out_for_delivery", "delivered"].indexOf(step.status); const ActiveIcon = step.Icon; return <li className={`relative flex gap-3 text-sm ${done ? "text-ink" : "text-stone-400"}`} key={step.status}><span className={`absolute -left-[31px] grid h-5 w-5 place-items-center rounded-full ${done ? "bg-saffron text-white" : "bg-orange-100"}`}><ActiveIcon className="h-3 w-3" /></span>{step.text}</li>; })}</ol><div className="mt-7 border-t border-orange-100 pt-5 text-sm"><p className="flex gap-2"><Store className="h-4 w-4 text-saffron" />{tracking.restaurant.name}</p><p className="mt-3 flex gap-2 text-stone-600"><MapPin className="h-4 w-4 text-moss" />{tracking.customerAddress.address_text}</p>{tracking.rider && <p className="mt-3 flex gap-2 text-stone-600"><Navigation className="h-4 w-4 text-saffron" />Rider updated {new Date(tracking.rider.recordedAt).toLocaleTimeString()}</p>}</div></>}</Card><div className="order-1 min-h-[460px] overflow-hidden rounded-3xl border border-orange-100 bg-orange-100 lg:order-2">{mapError ? <div className="grid h-full min-h-[460px] place-items-center p-8"><StatusNote tone="error">{mapError}</StatusNote></div> : <div ref={mapContainer} className="h-full min-h-[460px]" />}</div></section></main>;
}
