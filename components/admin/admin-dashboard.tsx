"use client";

import Link from "next/link";
import { CreditCard, LoaderCircle, PackageCheck, Plus, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StoreLocationPicker } from "@/components/maps/store-location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { formatINR } from "@/lib/utils";

type Operations = { restaurant: any; categories: any[]; orders: any[]; members: any[]; membershipRole: "owner" | "manager" };

export function AdminDashboard({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<Operations | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [item, setItem] = useState({ categoryId: "", name: "", price: "" });
  const [team, setTeam] = useState({ email: "", role: "rider" });
  const settingsFormRef = useRef<HTMLFormElement>(null);

  async function load() {
    const response = await fetch(`/api/admin/restaurants/${restaurantId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Operations could not be loaded.");
    setData(payload);
    setItem((current) => ({ ...current, categoryId: current.categoryId || payload.categories[0]?.id || "" }));
  }

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Operations could not be loaded."));
  }, [restaurantId]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const razorpayKeyId = String(form.get("razorpayKeyId") ?? "").trim();
    const razorpayKeySecret = String(form.get("razorpayKeySecret") ?? "").trim();
    const razorpayWebhookSecret = String(form.get("razorpayWebhookSecret") ?? "").trim();
    const response = await fetch(`/api/admin/restaurants/${restaurantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        addressText: form.get("addressText"),
        phone: form.get("phone") || null,
        description: form.get("description") || null,
        latitude: Number(form.get("latitude")),
        longitude: Number(form.get("longitude")),
        deliveryFeeBase: Number(form.get("deliveryFeeBase")),
        deliveryFeePerKm: Number(form.get("deliveryFeePerKm")),
        deliveryRadiusKm: Number(form.get("deliveryRadiusKm")),
        active: form.get("active") === "on",
        ...(razorpayKeyId || razorpayKeySecret || razorpayWebhookSecret ? { razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret } : {}),
        clearRazorpayCredentials: form.get("clearRazorpayCredentials") === "on",
      }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) { setMessage(payload.error); return; }
    setData({ ...data, restaurant: payload });
    ["razorpayKeyId", "razorpayKeySecret", "razorpayWebhookSecret"].forEach((name) => {
      const input = formElement.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = "";
    });
    const clearCredentials = formElement.elements.namedItem("clearRazorpayCredentials") as HTMLInputElement | null;
    if (clearCredentials) clearCredentials.checked = false;
    setMessage("Restaurant settings saved.");
  }

  async function createMenu(kind: "category" | "item") {
    const payload = kind === "category" ? { kind, name: categoryName } : { kind, categoryId: item.categoryId, name: item.name, price: Number(item.price), vegetarian: true };
    const response = await fetch(`/api/admin/restaurants/${restaurantId}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setCategoryName("");
    setItem({ categoryId: item.categoryId, name: "", price: "" });
    await load();
  }

  async function addMember(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/admin/restaurants/${restaurantId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(team) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setTeam({ email: "", role: "rider" });
    setMessage("Team member added.");
    await load();
  }

  async function updateOrder(id: string, status: string) {
    const response = await fetch(`/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    await load();
  }

  async function assignRider(orderId: string, riderId: string) {
    if (!riderId) return;
    const response = await fetch(`/api/admin/orders/${orderId}/assignment`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ riderId }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setMessage("Rider assigned.");
    await load();
  }

  if (!data) return <main className="grid min-h-screen place-items-center bg-cream"><LoaderCircle className="h-7 w-7 animate-spin text-saffron" /></main>;
  const restaurant = data.restaurant;
  const riders = data.members.filter((member) => member.role === "rider");
  const canEditPayments = data.membershipRole === "owner";

  return <main className="min-h-screen bg-cream">
    <header className="border-b border-orange-100 bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href={`/restaurants/${restaurant.slug}`} className="font-bold">← {restaurant.name}</Link><span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">Operations</span></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8">
      {message && <div className="mb-5"><StatusNote tone={message.includes("saved") || message.includes("added") || message.includes("assigned") ? "success" : "error"}>{message}</StatusNote></div>}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="p-6">
          <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-saffron" /><h1 className="display-font text-3xl">Restaurant settings</h1></div>
          <form ref={settingsFormRef} className="mt-6 space-y-4" onSubmit={(event) => void saveSettings(event)}>
            <div className="grid gap-3 sm:grid-cols-2"><Input name="name" defaultValue={restaurant.name} required /><Input name="phone" defaultValue={restaurant.phone ?? ""} placeholder="Contact phone" /></div>
            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-sm"><p className="font-bold text-ink">Restaurant owner</p><p className="mt-1 text-stone-600">{restaurant.owner_name || "Owner details were not provided."}</p>{restaurant.owner_email && <p className="mt-1 text-stone-600">{restaurant.owner_email}</p>}</div>
            <Input name="addressText" defaultValue={restaurant.address_text ?? ""} placeholder="Store address" required />
            <textarea name="description" defaultValue={restaurant.description ?? ""} className="min-h-20 w-full rounded-xl border border-stone-200 bg-white p-3 outline-none focus:ring-4 focus:ring-orange-100" placeholder="Restaurant description" />
            <div className="grid gap-3 sm:grid-cols-3"><Input name="deliveryFeeBase" type="number" min="0" step="0.01" defaultValue={restaurant.delivery_fee_base} aria-label="Base delivery fee" /><Input name="deliveryFeePerKm" type="number" min="0" step="0.01" defaultValue={restaurant.delivery_fee_per_km} aria-label="Fee per km" /><Input name="deliveryRadiusKm" type="number" min="0.1" step="0.1" defaultValue={restaurant.delivery_radius_km} aria-label="Delivery radius" /></div>
            <StoreLocationPicker latitude={Number(restaurant.latitude)} longitude={Number(restaurant.longitude)} onChange={({ latitude, longitude }) => { const latitudeInput = settingsFormRef.current?.elements.namedItem("latitude") as HTMLInputElement | null; const longitudeInput = settingsFormRef.current?.elements.namedItem("longitude") as HTMLInputElement | null; if (latitudeInput) latitudeInput.value = String(latitude); if (longitudeInput) longitudeInput.value = String(longitude); }} />
            <div className="grid gap-3 sm:grid-cols-2"><Input name="latitude" type="number" step="0.000001" defaultValue={restaurant.latitude} /><Input name="longitude" type="number" step="0.000001" defaultValue={restaurant.longitude} /></div>
            <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4">
              <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-saffron" /><div><h2 className="font-bold">Razorpay online payments</h2><p className="text-sm text-stone-600">{restaurant.razorpayConfigured ? `Configured (${restaurant.razorpayKeyIdHint})` : "Not configured — customers can still place COD orders."}</p></div></div>
              {canEditPayments ? <div className="mt-4 space-y-3"><Input name="razorpayKeyId" autoComplete="off" placeholder="Razorpay Key ID" /><Input name="razorpayKeySecret" type="password" autoComplete="new-password" placeholder="Razorpay Key Secret" /><Input name="razorpayWebhookSecret" type="password" autoComplete="new-password" placeholder="Razorpay Webhook Secret" /><p className="text-xs leading-5 text-stone-600">Leave all fields blank to keep the current payment credentials. Configure <code>payment.captured</code> and <code>payment.failed</code> at your public <code>/api/webhooks/razorpay</code> URL using this webhook secret.</p>{restaurant.razorpayConfigured && <label className="flex items-center gap-2 text-sm font-semibold text-red-700"><input name="clearRazorpayCredentials" type="checkbox" />Disable online payments and remove credentials</label>}</div> : <div className="mt-4"><StatusNote><ShieldCheck className="h-4 w-4" />Only the restaurant owner can change payment credentials.</StatusNote></div>}
            </section>
            <label className="flex items-center gap-2 text-sm font-semibold"><input name="active" type="checkbox" defaultChecked={restaurant.active} />Accept orders</label>
            <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Save restaurant settings</Button>
          </form>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-saffron" /><h2 className="display-font text-2xl">Team access</h2></div>
          <p className="mt-2 text-sm text-stone-600">Members must create and confirm a staff email account before being added.</p>
          <form className="mt-5 space-y-3" onSubmit={(event) => void addMember(event)}><Input type="email" placeholder="Rider/manager email" value={team.email} onChange={(event) => setTeam({ ...team, email: event.target.value })} /><select className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3" value={team.role} onChange={(event) => setTeam({ ...team, role: event.target.value })}><option value="rider">Rider</option><option value="manager">Manager</option></select><Button size="sm" type="submit"><Plus className="h-4 w-4" />Add team member</Button></form>
          <div className="mt-5 space-y-2">{data.members.map((member) => <div className="flex items-center justify-between rounded-xl bg-orange-50 px-3 py-2 text-sm" key={member.user_id}><span>{member.profiles?.display_name || member.profiles?.email || member.user_id.slice(0, 8)}</span><span className="font-bold capitalize text-saffron">{member.role}</span></div>)}</div>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><h2 className="display-font text-2xl">Menu studio</h2><div className="mt-5 grid gap-4 border-b border-orange-100 pb-5 sm:grid-cols-[1fr_auto]"><Input placeholder="New category, e.g. Burgers" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /><Button variant="secondary" disabled={!categoryName} onClick={() => void createMenu("category")}><Plus className="h-4 w-4" />Category</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><select className="h-12 rounded-xl border border-stone-200 bg-white px-3" value={item.categoryId} onChange={(event) => setItem({ ...item, categoryId: event.target.value })}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input placeholder="Item name" value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} /><Input placeholder="Price in INR" type="number" min="0" value={item.price} onChange={(event) => setItem({ ...item, price: event.target.value })} /><Button variant="secondary" disabled={!item.categoryId || !item.name || !item.price} onClick={() => void createMenu("item")}><Plus className="h-4 w-4" />Menu item</Button></div><div className="mt-5 space-y-3">{data.categories.map((category) => <div key={category.id}><p className="font-bold">{category.name}</p><div className="mt-2 flex flex-wrap gap-2">{(category.menu_items ?? []).map((menuItem: any) => <span className="rounded-full bg-orange-50 px-3 py-1 text-sm" key={menuItem.id}>{menuItem.name} · {formatINR(Number(menuItem.price))}</span>)}</div></div>)}</div></Card>
        <Card className="p-6"><div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-saffron" /><h2 className="display-font text-2xl">Live orders</h2></div><div className="mt-5 space-y-3">{data.orders.map((order) => <div className="rounded-2xl border border-orange-100 p-4" key={order.id}><div className="flex items-center justify-between"><span className="font-mono text-xs text-stone-500">#{order.id.slice(0, 8)}</span><span className="font-bold">{formatINR(Number(order.total))}</span></div><p className="mt-2 text-sm font-semibold capitalize">{String(order.status).replaceAll("_", " ")} · {order.payment_method}</p>{order.deliveryPhone && <p className="mt-2 text-sm text-stone-600">Delivery contact: <a className="font-semibold text-ink hover:underline" href={`tel:${order.deliveryPhone}`}>{order.deliveryPhone}</a></p>}{riders.length > 0 && <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-stone-500">Assign rider<select className="mt-1 h-9 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm font-normal text-ink" defaultValue={order.delivery_assignments?.[0]?.rider_id ?? ""} onChange={(event) => void assignRider(order.id, event.target.value)}><option value="">Choose a rider</option>{riders.map((rider) => <option key={rider.user_id} value={rider.user_id}>{rider.profiles?.display_name || rider.profiles?.email || rider.user_id.slice(0, 8)}</option>)}</select></label>}<div className="mt-3 flex flex-wrap gap-2">{nextStatuses(order.status).map((status) => <Button size="sm" variant="secondary" key={status} onClick={() => void updateOrder(order.id, status)}>{status.replaceAll("_", " ")}</Button>)}</div></div>)}{!data.orders.length && <p className="text-sm text-stone-600">Orders will appear here as soon as customers check out.</p>}</div></Card>
      </div>
    </div>
  </main>;
}

function nextStatuses(status: string) {
  return ({ pending_approval: ["confirmed", "cancelled"], confirmed: ["preparing", "cancelled"], preparing: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"], pending_payment: [], delivered: [], cancelled: [] } as Record<string, string[]>)[status] ?? [];
}
