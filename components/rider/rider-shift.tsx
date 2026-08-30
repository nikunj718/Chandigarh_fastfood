"use client";

import { LocateFixed, Radio, ShieldAlert, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";

type Assignment = { order_id: string; restaurant_id: string; orders: { id: string; status: string; customer_address_snapshot: { address_text: string }; restaurant_snapshot: { name: string }; deliveryPhone: string | null } };

export function RiderShift() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [tracking, setTracking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const interval = useRef<number | null>(null);
  const latestOrderId = useRef("");
  latestOrderId.current = selectedOrderId;
  useEffect(() => { if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js"); fetch("/api/rider/assignments").then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setAssignments(payload); setSelectedOrderId(payload.find((entry: Assignment) => entry.orders.status === "out_for_delivery")?.order_id ?? payload[0]?.order_id ?? ""); }).catch((error) => setNotice(error instanceof Error ? error.message : "Assignments could not be loaded.")); }, []);
  useEffect(() => () => { if (interval.current) window.clearInterval(interval.current); }, []);

  async function sendLocation() {
    if (!latestOrderId.current) return;
    if (!navigator.geolocation) { setNotice("This browser does not support GPS location."); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (position.coords.accuracy > 500) { setNotice("GPS accuracy is too low. Move closer to an open area and try again."); return; }
      const response = await fetch("/api/rider/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: latestOrderId.current, latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }) });
      const payload = await response.json();
      setNotice(response.ok ? `Location sent at ${new Date().toLocaleTimeString()}.` : payload.error ?? "Location could not be sent.");
    }, () => setNotice("Location permission was denied. Enable it to start active-shift sharing."), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  }
  function startShift() { if (!selectedOrderId) return; setTracking(true); void sendLocation(); interval.current = window.setInterval(() => void sendLocation(), 30000); }
  function stopShift() { if (interval.current) window.clearInterval(interval.current); interval.current = null; setTracking(false); setNotice("Active-shift location sharing stopped."); }
  const selected = assignments.find((assignment) => assignment.order_id === selectedOrderId);
  return <main className="grid min-h-screen place-items-center bg-cream p-5"><Card className="w-full max-w-xl p-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Rider active shift</p><h1 className="display-font mt-2 text-4xl">Share your delivery location.</h1><p className="mt-3 text-stone-600">Your phone sends an accuracy-checked GPS point every 30 seconds while this PWA remains open.</p><label className="mt-7 block text-sm font-bold">Assigned delivery<select className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-3" value={selectedOrderId} disabled={tracking} onChange={(event) => setSelectedOrderId(event.target.value)}>{assignments.map((assignment) => <option key={assignment.order_id} value={assignment.order_id}>{assignment.orders.restaurant_snapshot.name} → {assignment.orders.customer_address_snapshot.address_text}</option>)}</select></label>{selected?.orders.deliveryPhone && <p className="mt-3 text-sm text-stone-600">Customer contact: <a className="font-semibold text-ink hover:underline" href={`tel:${selected.orders.deliveryPhone}`}>{selected.orders.deliveryPhone}</a></p>}{!assignments.length && <div className="mt-5"><StatusNote>No active rider assignment yet. Ask a restaurant owner to assign an out-for-delivery order.</StatusNote></div>}{notice && <div className="mt-5"><StatusNote tone={notice.includes("denied") || notice.includes("could not") || notice.includes("too low") ? "error" : "info"}>{notice}</StatusNote></div>}<div className="mt-6 flex gap-3">{tracking ? <Button variant="danger" onClick={stopShift}><WifiOff className="h-4 w-4" />Stop sharing</Button> : <Button disabled={!selected || selected.orders.status !== "out_for_delivery"} onClick={startShift}><Radio className="h-4 w-4" />Start active shift</Button>}<Button variant="secondary" disabled={!selectedOrderId || tracking} onClick={() => void sendLocation()}><LocateFixed className="h-4 w-4" />Send now</Button></div><div className="mt-7 flex gap-3 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900"><ShieldAlert className="h-5 w-5 shrink-0 text-saffron" /><p><strong>Keep this screen open.</strong> Mobile browsers may suspend GPS when the app is backgrounded. This PWA alerts customers with the last known location but cannot guarantee background tracking.</p></div></Card></main>;
}
