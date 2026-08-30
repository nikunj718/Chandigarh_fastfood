"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StatusNote } from "@/components/ui/status-note";
import { OPEN_STREET_MAP_ATTRIBUTION, OPEN_STREET_MAP_TILE_URL } from "@/lib/open-street-map";

type Point = { latitude: number; longitude: number };

function pinIcon(L: any) {
  return L.divIcon({
    className: "",
    html: '<span style="display:block;width:24px;height:24px;border-radius:9999px;background:#dc6b20;border:3px solid white;box-shadow:0 2px 8px rgba(34,23,17,.35)"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function StoreLocationPicker({ latitude, longitude, onChange }: Point & { onChange: (point: Point) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const leaflet = useRef<any>(null);
  const latestPoint = useRef<Point>({ latitude, longitude });
  const onChangeRef = useRef(onChange);
  const [mapError, setMapError] = useState<string | null>(null);

  latestPoint.current = { latitude, longitude };
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    let currentMap: any = null;

    const initialise = async () => {
      const module = await import("leaflet");
      const L = module.default;
      if (disposed || !container.current) return;
      const point = latestPoint.current;
      currentMap = L.map(container.current, { zoomControl: true }).setView([point.latitude, point.longitude], 14);
      L.tileLayer(OPEN_STREET_MAP_TILE_URL, { attribution: OPEN_STREET_MAP_ATTRIBUTION, maxZoom: 19 }).addTo(currentMap);
      const nextMarker = L.marker([point.latitude, point.longitude], { draggable: true, icon: pinIcon(L) }).addTo(currentMap);
      const emitPosition = () => {
        const position = nextMarker.getLatLng();
        onChangeRef.current({ latitude: Number(position.lat.toFixed(6)), longitude: Number(position.lng.toFixed(6)) });
      };
      const moveMarkerToClick = (event: any) => { nextMarker.setLatLng(event.latlng); emitPosition(); };
      nextMarker.on("dragend", emitPosition);
      currentMap.on("click", moveMarkerToClick);
      map.current = currentMap;
      marker.current = nextMarker;
      leaflet.current = L;
    };

    void initialise().catch(() => setMapError("The map could not be loaded. You can select a different address and try again."));
    return () => {
      disposed = true;
      currentMap?.remove();
      map.current = null;
      marker.current = null;
      leaflet.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !marker.current) return;
    const point: [number, number] = [latitude, longitude];
    marker.current.setLatLng(point);
    map.current.flyTo(point, map.current.getZoom(), { duration: 0.35 });
  }, [latitude, longitude]);

  if (mapError) return <StatusNote tone="error">{mapError}</StatusNote>;
  return <div><div ref={container} className="mt-2 h-56 overflow-hidden rounded-2xl border border-orange-100" /><p className="mt-2 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3 w-3" />Click or drag the pin to set the pickup location.</p></div>;
}
