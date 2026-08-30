"use client";

import mapboxgl from "mapbox-gl";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import { env } from "@/lib/env";
import { StatusNote } from "@/components/ui/status-note";

export function StoreLocationPicker({ latitude, longitude, onChange }: { latitude: number; longitude: number; onChange: (point: { latitude: number; longitude: number }) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  useEffect(() => {
    if (!env.mapboxPublicToken || !container.current || map.current) return;
    mapboxgl.accessToken = env.mapboxPublicToken;
    map.current = new mapboxgl.Map({ container: container.current, style: "mapbox://styles/mapbox/streets-v12", center: [longitude, latitude], zoom: 14, attributionControl: false });
    marker.current = new mapboxgl.Marker({ color: "#dc6b20", draggable: true }).setLngLat([longitude, latitude]).addTo(map.current);
    const emitMarkerPosition = () => { const point = marker.current!.getLngLat(); onChange({ longitude: Number(point.lng.toFixed(6)), latitude: Number(point.lat.toFixed(6)) }); };
    const moveMarkerToClick = (event: mapboxgl.MapMouseEvent) => { marker.current!.setLngLat(event.lngLat); emitMarkerPosition(); };
    marker.current.on("dragend", emitMarkerPosition);
    map.current.on("click", moveMarkerToClick);
    return () => { marker.current?.off("dragend", emitMarkerPosition); map.current?.off("click", moveMarkerToClick); map.current?.remove(); map.current = null; marker.current = null; };
  }, []);
  useEffect(() => { if (map.current && marker.current) { marker.current.setLngLat([longitude, latitude]); map.current.flyTo({ center: [longitude, latitude], duration: 350 }); } }, [latitude, longitude]);
  if (!env.mapboxPublicToken) return <StatusNote>Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to confirm the interactive store pin. Address search still sets the store location.</StatusNote>;
  return <div><div ref={container} className="mt-2 h-56 overflow-hidden rounded-2xl border border-orange-100" /><p className="mt-2 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3 w-3" />Click or drag the pin to set the pickup location.</p></div>;
}
