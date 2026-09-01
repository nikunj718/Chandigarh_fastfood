"use client";

import { LocateFixed, MapPin, Navigation, Phone, Radio, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";

type Assignment = {
  order_id: string;
  restaurant_id: string;
  assigned_at: string;
  queueState: "upcoming" | "current" | "next" | "waiting";
  orders: {
    id: string;
    order_number: number | null;
    status: string;
    total: number;
    customer_address_snapshot: { address_text: string; latitude: number; longitude: number };
    restaurant_snapshot: { name: string };
    deliveryPhone: string | null;
  };
};

const queueLabels: Record<Assignment["queueState"], string> = {
  upcoming: "Awaiting dispatch",
  current: "Current stop",
  next: "Next stop",
  waiting: "Other stops first",
};

export function RiderShift() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tracking, setTracking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const locationInterval = useRef<number | null>(null);

  const loadAssignments = useCallback(async () => {
    const response = await fetch("/api/rider/assignments");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Assignments could not be loaded.");
    setAssignments(payload);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    void loadAssignments().catch((error) => setNotice(error instanceof Error ? error.message : "Assignments could not be loaded.")).finally(() => setLoading(false));
    const refreshInterval = window.setInterval(() => void loadAssignments().catch(() => undefined), 15_000);
    return () => window.clearInterval(refreshInterval);
  }, [loadAssignments]);

  useEffect(() => () => { if (locationInterval.current) window.clearInterval(locationInterval.current); }, []);

  const dispatchedAssignments = assignments.filter((assignment) => assignment.orders.status === "out_for_delivery");

  async function sendLocation() {
    if (!dispatchedAssignments.length) { setNotice("Location sharing starts after a restaurant sends an assigned order out for delivery."); return; }
    if (!navigator.geolocation) { setNotice("This browser does not support GPS location."); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (position.coords.accuracy > 500) { setNotice("GPS accuracy is too low. Move closer to an open area and try again."); return; }
      const response = await fetch("/api/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy }),
      });
      const payload = await response.json();
      setNotice(response.ok ? `Location shared with ${payload.deliveriesUpdated} active ${payload.deliveriesUpdated === 1 ? "delivery" : "deliveries"} at ${new Date().toLocaleTimeString()}.` : payload.error ?? "Location could not be sent.");
    }, () => setNotice("Location permission was denied. Enable it to start active-shift sharing."), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 });
  }

  function enableLocation() {
    if (!dispatchedAssignments.length) return;
    setTracking(true);
    void sendLocation();
    locationInterval.current = window.setInterval(() => void sendLocation(), 30_000);
  }

  function disableLocation() {
    if (locationInterval.current) window.clearInterval(locationInterval.current);
    locationInterval.current = null;
    setTracking(false);
    setNotice("Live location sharing stopped.");
  }

  async function makeCurrentStop(orderId: string) {
    const response = await fetch("/api/rider/current-stop", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
    const payload = await response.json();
    if (!response.ok) { setNotice(payload.error ?? "Current stop could not be updated."); return; }
    setNotice("Current stop updated. Customer tracking refreshed.");
    await loadAssignments();
  }

  async function refresh() {
    setLoading(true);
    try { await loadAssignments(); setNotice(null); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Assignments could not be loaded."); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-cream px-5 py-8"><section className="mx-auto max-w-3xl"><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Rider portal</p><h1 className="display-font mt-2 text-4xl">Today’s deliveries</h1><p className="mt-3 max-w-xl text-stone-600">Choose the stop you are delivering now, then enable location to update every dispatched customer from this device.</p></div><Button variant="secondary" disabled={loading} onClick={() => void refresh()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></header>{notice && <div className="mt-5"><StatusNote tone={notice.includes("denied") || notice.includes("could not") || notice.includes("too low") ? "error" : "info"}>{notice}</StatusNote></div>}<Card className="mt-6 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold">Live location</p><p className="mt-1 text-sm text-stone-600">Shares an accuracy-checked GPS point every 30 seconds while this page stays open.</p></div>{tracking ? <Button variant="danger" onClick={disableLocation}><WifiOff className="h-4 w-4" />Disable location</Button> : <Button disabled={!dispatchedAssignments.length} onClick={enableLocation}><Radio className="h-4 w-4" />Enable location</Button>}</div></Card><div className="mt-6 grid gap-4">{assignments.map((assignment) => <Card className={`p-5 ${assignment.queueState === "current" ? "border-saffron ring-2 ring-orange-100" : ""}`} key={assignment.order_id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-stone-500">Order #{assignment.orders.order_number ?? assignment.order_id.slice(0, 8)}</p><h2 className="mt-1 text-lg font-bold">{assignment.orders.restaurant_snapshot.name}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${assignment.queueState === "current" ? "bg-orange-100 text-saffron" : "bg-stone-100 text-stone-700"}`}>{queueLabels[assignment.queueState]}</span></div><div className="mt-4 grid gap-3 text-sm"><p className="flex gap-2 text-stone-700"><MapPin className="h-4 w-4 shrink-0 text-moss" />{assignment.orders.customer_address_snapshot.address_text}</p>{assignment.orders.deliveryPhone && <p className="flex gap-2 text-stone-700"><Phone className="h-4 w-4 shrink-0 text-saffron" /><a className="font-semibold hover:underline" href={`tel:${assignment.orders.deliveryPhone}`}>{assignment.orders.deliveryPhone}</a></p>}</div><div className="mt-5 flex flex-wrap gap-2">{assignment.orders.status === "out_for_delivery" && assignment.queueState !== "current" && <Button size="sm" variant="secondary" onClick={() => void makeCurrentStop(assignment.order_id)}><Navigation className="h-4 w-4" />Make current stop</Button>}{assignment.orders.status === "out_for_delivery" && assignment.queueState === "current" && <Button size="sm" variant="secondary" disabled><LocateFixed className="h-4 w-4" />Current stop</Button>}</div></Card>)}{!loading && !assignments.length && <Card className="p-7"><StatusNote>No active rider assignment yet. A restaurant owner will assign your deliveries here.</StatusNote></Card>}</div><div className="mt-6 flex gap-3 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900"><ShieldAlert className="h-5 w-5 shrink-0 text-saffron" /><p><strong>Keep this page open.</strong> Mobile browsers may suspend GPS in the background, so riders should keep the Rider Portal visible during active deliveries.</p></div></section></main>;
}
