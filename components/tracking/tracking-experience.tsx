"use client";

import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { CheckCircle2, Clock3, MapPin, Navigation, Store, Truck, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
import { env } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/utils";

type TrackingData = {
  orderId: string;
  status: string;
  paymentStatus: string;
  restaurant: { name: string; latitude: number; longitude: number; address_text?: string };
  customerAddress: { address_text: string; latitude: number; longitude: number };
  rider: { latitude: number; longitude: number; recordedAt: string } | null;
  riderAssigned: boolean;
  etaSeconds: number | null;
  route: GeoJSON.LineString | null;
};

const labels: Record<string, string> = { pending_payment: "Awaiting payment", pending_approval: "Awaiting restaurant approval", confirmed: "Order confirmed", preparing: "Being prepared", out_for_delivery: "On the way", delivered: "Delivered", cancelled: "Cancelled" };

export function TrackingExperience({ orderId }: { orderId: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ restaurant?: mapboxgl.Marker; customer?: mapboxgl.Marker; rider?: mapboxgl.Marker }>({});
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
    if (!env.mapboxPublicToken || !mapContainer.current || mapRef.current) return;
    mapboxgl.accessToken = env.mapboxPublicToken;
    mapRef.current = new mapboxgl.Map({ container: mapContainer.current, style: "mapbox://styles/mapbox/streets-v12", center: [78.9629, 20.5937], zoom: 4, attributionControl: false });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tracking) return;
    const update = () => {
      const restaurantPoint: [number, number] = [tracking.restaurant.longitude, tracking.restaurant.latitude];
      const customerPoint: [number, number] = [tracking.customerAddress.longitude, tracking.customerAddress.latitude];
      markers.current.restaurant ??= new mapboxgl.Marker({ color: "#dc6b20" }).setLngLat(restaurantPoint).setPopup(new mapboxgl.Popup().setText(tracking.restaurant.name)).addTo(map);
      markers.current.customer ??= new mapboxgl.Marker({ color: "#506b48" }).setLngLat(customerPoint).setPopup(new mapboxgl.Popup().setText("Delivery address")).addTo(map);
      markers.current.restaurant.setLngLat(restaurantPoint); markers.current.customer.setLngLat(customerPoint);
      if (tracking.rider) {
        const riderPoint: [number, number] = [tracking.rider.longitude, tracking.rider.latitude];
        markers.current.rider ??= new mapboxgl.Marker({ color: "#221711" }).setLngLat(riderPoint).addTo(map);
        markers.current.rider.setLngLat(riderPoint);
      }
      const source = map.getSource("delivery-route") as mapboxgl.GeoJSONSource | undefined;
      const routeData = { type: "Feature", properties: {}, geometry: tracking.route ?? { type: "LineString", coordinates: [restaurantPoint, customerPoint] } } as GeoJSON.Feature<GeoJSON.LineString>;
      if (source) source.setData(routeData); else {
        map.addSource("delivery-route", { type: "geojson", data: routeData });
        map.addLayer({ id: "delivery-route", type: "line", source: "delivery-route", paint: { "line-color": "#dc6b20", "line-width": 5, "line-opacity": 0.75 } });
      }
      const bounds = new mapboxgl.LngLatBounds(restaurantPoint, customerPoint); if (tracking.rider) bounds.extend([tracking.rider.longitude, tracking.rider.latitude]); map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 700 });
    };
    if (map.isStyleLoaded()) update(); else map.once("load", update);
  }, [tracking]);
  useEffect(() => {
    if (!env.supabaseUrl || !env.supabaseAnonKey) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`delivery-${orderId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_location_points", filter: `order_id=eq.${orderId}` }, () => { void load().catch(() => setError("Live location briefly disconnected. Retrying…")); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, orderId]);

  const eta = tracking?.etaSeconds ? `${Math.max(1, Math.ceil(tracking.etaSeconds / 60))} min` : "Calculating";
  const steps: Array<{ status: string; Icon: LucideIcon; text: string }> = [
    { status: "confirmed", Icon: CheckCircle2, text: "Restaurant confirmed" },
    { status: "preparing", Icon: Store, text: "Freshly preparing your order" },
    { status: "out_for_delivery", Icon: Truck, text: "Rider is on the way" },
    { status: "delivered", Icon: MapPin, text: "Delivered to your door" },
  ];
  return <main className="min-h-screen bg-cream"><header className="border-b border-orange-100 bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href="/restaurants" className="font-bold">Fastfood Delivery</Link><span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-saffron">Live delivery</span></div></header><section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[360px_1fr]"><Card className="order-2 p-6 lg:order-1"><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Order tracking</p><h1 className="display-font mt-2 text-3xl">{tracking ? labels[tracking.status] ?? tracking.status : "Finding your order"}</h1>{error && <div className="mt-5"><StatusNote tone="error">{error}</StatusNote></div>}{tracking && <><div className="mt-7 rounded-2xl bg-orange-50 p-4"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-saffron" /><div><p className="text-xs font-bold uppercase tracking-wide text-stone-500">Current ETA</p><p className="text-xl font-bold">{eta}</p></div></div></div><ol className="mt-7 space-y-5 border-l border-orange-200 pl-5">{steps.map((step) => { const order = ["pending_payment", "pending_approval", "confirmed", "preparing", "out_for_delivery", "delivered"].indexOf(tracking.status); const done = order >= ["confirmed", "preparing", "out_for_delivery", "delivered"].indexOf(step.status); const ActiveIcon = step.Icon; return <li className={`relative flex gap-3 text-sm ${done ? "text-ink" : "text-stone-400"}`} key={step.status}><span className={`absolute -left-[31px] grid h-5 w-5 place-items-center rounded-full ${done ? "bg-saffron text-white" : "bg-orange-100"}`}><ActiveIcon className="h-3 w-3" /></span>{step.text}</li>; })}</ol><div className="mt-7 border-t border-orange-100 pt-5 text-sm"><p className="flex gap-2"><Store className="h-4 w-4 text-saffron" />{tracking.restaurant.name}</p><p className="mt-3 flex gap-2 text-stone-600"><MapPin className="h-4 w-4 text-moss" />{tracking.customerAddress.address_text}</p>{tracking.rider && <p className="mt-3 flex gap-2 text-stone-600"><Navigation className="h-4 w-4 text-saffron" />Rider updated {new Date(tracking.rider.recordedAt).toLocaleTimeString()}</p>}</div></>}</Card><div className="order-1 min-h-[460px] overflow-hidden rounded-3xl border border-orange-100 bg-orange-100 lg:order-2">{env.mapboxPublicToken ? <div ref={mapContainer} className="h-full min-h-[460px]" /> : <div className="grid h-full min-h-[460px] place-items-center p-8 text-center text-stone-600"><div><MapPin className="mx-auto h-8 w-8 text-saffron" /><p className="mt-3 font-semibold">Add NEXT_PUBLIC_MAPBOX_TOKEN to display the live map.</p><p className="mt-1 text-sm">Order status and protected tracking still remain available.</p></div></div>}</div></section></main>;
}
