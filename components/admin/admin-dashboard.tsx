"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, CreditCard, ImagePlus, LoaderCircle, PackageCheck, Plus, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StoreLocationPicker } from "@/components/maps/store-location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { defaultOperatingHours, weekdayLabels } from "@/lib/operating-hours";
import type { MenuItem, OperatingHour } from "@/lib/types";
import { formatINR } from "@/lib/utils";

type AdminCategory = { id: string; name: string; menu_items?: MenuItem[] };
type Operations = {
  restaurant: any;
  categories: AdminCategory[];
  orders: any[];
  members: any[];
  membershipRole: "owner" | "manager";
  operatingHours: OperatingHour[];
  ownerAccountNeedsSecurity: boolean;
};

export function AdminDashboard({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<Operations | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [item, setItem] = useState({ categoryId: "", name: "", description: "", price: "", vegetarian: true });
  const [team, setTeam] = useState({ email: "", role: "rider" });
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>(defaultOperatingHours());
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set());

  async function load() {
    const response = await fetch(`/api/admin/restaurants/${restaurantId}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Operations could not be loaded.");
    setData(payload);
    setOperatingHours(payload.operatingHours ?? defaultOperatingHours());
    setCoordinates({ latitude: Number(payload.restaurant.latitude), longitude: Number(payload.restaurant.longitude) });
    setItem((current) => ({ ...current, categoryId: current.categoryId || payload.categories[0]?.id || "" }));
  }

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "Operations could not be loaded."));
  }, [restaurantId]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !coordinates) return;
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const razorpayKeyId = String(form.get("razorpayKeyId") ?? "").trim();
    const razorpayKeySecret = String(form.get("razorpayKeySecret") ?? "").trim();
    const razorpayWebhookSecret = String(form.get("razorpayWebhookSecret") ?? "").trim();
    try {
      const response = await fetch(`/api/admin/restaurants/${restaurantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          addressText: form.get("addressText"),
          phone: form.get("phone") || null,
          description: form.get("description") || null,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          deliveryFeeBase: Number(form.get("deliveryFeeBase")),
          deliveryFeePerKm: Number(form.get("deliveryFeePerKm")),
          deliveryRadiusKm: Number(form.get("deliveryRadiusKm")),
          active: form.get("active") === "on",
          operatingHours,
          ...(razorpayKeyId || razorpayKeySecret || razorpayWebhookSecret ? { razorpayKeyId, razorpayKeySecret, razorpayWebhookSecret } : {}),
          clearRazorpayCredentials: form.get("clearRazorpayCredentials") === "on",
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Restaurant settings could not be saved.");
      setData({ ...data, restaurant: payload.restaurant, operatingHours: payload.operatingHours });
      setOperatingHours(payload.operatingHours);
      ["razorpayKeyId", "razorpayKeySecret", "razorpayWebhookSecret"].forEach((name) => {
        const input = formElement.elements.namedItem(name) as HTMLInputElement | null;
        if (input) input.value = "";
      });
      const clearCredentials = formElement.elements.namedItem("clearRazorpayCredentials") as HTMLInputElement | null;
      if (clearCredentials) clearCredentials.checked = false;
      setMessage("Restaurant settings saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Restaurant settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function updateHours(dayOfWeek: number, update: Partial<OperatingHour>) {
    setOperatingHours((hours) => hours.map((hour) => hour.dayOfWeek !== dayOfWeek ? hour : { ...hour, ...update }));
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  async function createMenu(kind: "category" | "item") {
    const payload = kind === "category"
      ? { kind, name: categoryName }
      : { kind, categoryId: item.categoryId, name: item.name, description: item.description || undefined, price: Number(item.price), vegetarian: item.vegetarian };
    const response = await fetch(`/api/admin/restaurants/${restaurantId}/menu`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setCategoryName("");
    setItem({ categoryId: item.categoryId, name: "", description: "", price: "", vegetarian: true });
    setMessage("Menu item added.");
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

  if (!data || !coordinates) return <main className="grid min-h-screen place-items-center bg-cream"><LoaderCircle className="h-7 w-7 animate-spin text-saffron" /></main>;
  const restaurant = data.restaurant;
  const riders = data.members.filter((member) => member.role === "rider");
  const canEditPayments = data.membershipRole === "owner";

  return <main className="min-h-screen bg-cream">
    <header className="border-b border-orange-100 bg-white px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link href={`/restaurants/${restaurant.slug}`} className="font-bold">← {restaurant.name}</Link><span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">Operations</span></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8">
      {data.ownerAccountNeedsSecurity && <div className="mb-5"><StatusNote><ShieldCheck className="h-4 w-4" />Secure your owner account by confirming your email and setting a password. Your restaurant access is already active. <Link className="font-bold underline" href={`/staff?restaurantId=${restaurantId}`}>Finish account setup</Link></StatusNote></div>}
      {message && <div className="mb-5"><StatusNote tone={message.includes("saved") || message.includes("added") || message.includes("assigned") || message.includes("uploaded") ? "success" : "error"}>{message}</StatusNote></div>}
      <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
        <Card className="p-6">
          <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-saffron" /><h1 className="display-font text-3xl">Restaurant settings</h1></div>
          <form className="mt-6 space-y-4" onSubmit={(event) => void saveSettings(event)}>
            <div className="grid gap-3 sm:grid-cols-2"><Input name="name" defaultValue={restaurant.name} required /><Input name="phone" defaultValue={restaurant.phone ?? ""} placeholder="Contact phone" /></div>
            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-sm"><p className="font-bold text-ink">Restaurant owner</p><p className="mt-1 text-stone-600">{restaurant.owner_name || "Owner details were not provided."}</p>{restaurant.owner_email && <p className="mt-1 text-stone-600">{restaurant.owner_email}</p>}</div>
            <Input name="addressText" defaultValue={restaurant.address_text ?? ""} placeholder="Store address" required />
            <textarea name="description" defaultValue={restaurant.description ?? ""} className="min-h-20 w-full rounded-xl border border-stone-200 bg-white p-3 outline-none focus:ring-4 focus:ring-orange-100" placeholder="Restaurant description" />
            <div className="grid gap-3 sm:grid-cols-3"><Input name="deliveryFeeBase" type="number" min="0" step="0.01" defaultValue={restaurant.delivery_fee_base} aria-label="Base delivery fee" /><Input name="deliveryFeePerKm" type="number" min="0" step="0.01" defaultValue={restaurant.delivery_fee_per_km} aria-label="Fee per km" /><Input name="deliveryRadiusKm" type="number" min="0.1" step="0.1" defaultValue={restaurant.delivery_radius_km} aria-label="Delivery radius" /></div>
            <section><p className="mb-2 text-sm font-bold">Store location</p><StoreLocationPicker latitude={coordinates.latitude} longitude={coordinates.longitude} onChange={setCoordinates} /><p className="mt-2 text-xs text-stone-500">Drag the pin to the store entrance. The exact coordinates stay behind this map helper.</p></section>
            <section className="rounded-2xl border border-orange-100 p-4"><div><h2 className="font-bold">Weekly operating hours</h2><p className="mt-1 text-sm text-stone-600">Times use India time. A closing time earlier than opening time continues into the next day.</p></div><div className="mt-4 space-y-3">{operatingHours.map((hour) => <div key={hour.dayOfWeek} className="grid items-center gap-2 sm:grid-cols-[105px_1fr_1fr]"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!hour.isClosed} onChange={(event) => updateHours(hour.dayOfWeek, event.target.checked ? { isClosed: false, opensAt: hour.opensAt ?? "09:00", closesAt: hour.closesAt ?? "22:00" } : { isClosed: true, opensAt: null, closesAt: null })} />{weekdayLabels[hour.dayOfWeek]}</label><Input type="time" aria-label={`${weekdayLabels[hour.dayOfWeek]} opening time`} disabled={hour.isClosed} value={hour.opensAt ?? ""} onChange={(event) => updateHours(hour.dayOfWeek, { opensAt: event.target.value })} /><Input type="time" aria-label={`${weekdayLabels[hour.dayOfWeek]} closing time`} disabled={hour.isClosed} value={hour.closesAt ?? ""} onChange={(event) => updateHours(hour.dayOfWeek, { closesAt: event.target.value })} /></div>)}</div></section>
            <section className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-saffron" /><div><h2 className="font-bold">Razorpay online payments</h2><p className="text-sm text-stone-600">{restaurant.razorpayConfigured ? `Configured (${restaurant.razorpayKeyIdHint})` : "Not configured — customers can still place COD orders."}</p></div></div>{canEditPayments ? <div className="mt-4 space-y-3"><Input name="razorpayKeyId" autoComplete="off" placeholder="Razorpay Key ID" /><Input name="razorpayKeySecret" type="password" autoComplete="new-password" placeholder="Razorpay Key Secret" /><Input name="razorpayWebhookSecret" type="password" autoComplete="new-password" placeholder="Razorpay Webhook Secret" /><p className="text-xs leading-5 text-stone-600">Leave all fields blank to keep current credentials. Configure <code>payment.captured</code> and <code>payment.failed</code> at <code>/api/webhooks/razorpay</code> with this webhook secret.</p>{restaurant.razorpayConfigured && <label className="flex items-center gap-2 text-sm font-semibold text-red-700"><input name="clearRazorpayCredentials" type="checkbox" />Disable online payments and remove credentials</label>}</div> : <div className="mt-4"><StatusNote><ShieldCheck className="h-4 w-4" />Only the restaurant owner can change payment credentials.</StatusNote></div>}</section>
            <label className="flex items-center gap-2 text-sm font-semibold"><input name="active" type="checkbox" defaultChecked={restaurant.active} />Accept orders</label>
            <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Save restaurant settings</Button>
          </form>
        </Card>
        <Card className="p-6"><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-saffron" /><h2 className="display-font text-2xl">Team access</h2></div><p className="mt-2 text-sm text-stone-600">Members must create and confirm a staff email account before being added.</p><form className="mt-5 space-y-3" onSubmit={(event) => void addMember(event)}><Input type="email" placeholder="Rider/manager email" value={team.email} onChange={(event) => setTeam({ ...team, email: event.target.value })} /><select className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3" value={team.role} onChange={(event) => setTeam({ ...team, role: event.target.value })}><option value="rider">Rider</option><option value="manager">Manager</option></select><Button size="sm" type="submit"><Plus className="h-4 w-4" />Add team member</Button></form><div className="mt-5 space-y-2">{data.members.map((member) => <div className="flex items-center justify-between rounded-xl bg-orange-50 px-3 py-2 text-sm" key={member.user_id}><span>{member.profiles?.display_name || member.profiles?.email || member.user_id.slice(0, 8)}</span><span className="font-bold capitalize text-saffron">{member.role}</span></div>)}</div></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6"><h2 className="display-font text-2xl">Menu studio</h2><div className="mt-5 grid gap-4 border-b border-orange-100 pb-5 sm:grid-cols-[1fr_auto]"><Input placeholder="New category, e.g. Burgers" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /><Button variant="secondary" disabled={!categoryName} onClick={() => void createMenu("category")}><Plus className="h-4 w-4" />Category</Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><select className="h-12 rounded-xl border border-stone-200 bg-white px-3" value={item.categoryId} onChange={(event) => setItem({ ...item, categoryId: event.target.value })}>{data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input placeholder="Item name" value={item.name} onChange={(event) => setItem({ ...item, name: event.target.value })} /><Input className="sm:col-span-2" placeholder="Short description" value={item.description} onChange={(event) => setItem({ ...item, description: event.target.value })} /><Input placeholder="Price in INR" type="number" min="0" value={item.price} onChange={(event) => setItem({ ...item, price: event.target.value })} /><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={item.vegetarian} onChange={(event) => setItem({ ...item, vegetarian: event.target.checked })} />Vegetarian</label><Button variant="secondary" disabled={!item.categoryId || !item.name || !item.price} onClick={() => void createMenu("item")}><Plus className="h-4 w-4" />Menu item</Button></div><div className="mt-6 space-y-3">{data.categories.map((category) => <MenuCategorySection key={category.id} category={category} expanded={expandedCategoryIds.has(category.id)} restaurantId={restaurantId} categories={data.categories} onToggle={() => toggleCategory(category.id)} onSaved={load} onMessage={setMessage} />)}</div></Card>
        <Card className="p-6"><div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-saffron" /><h2 className="display-font text-2xl">Live orders</h2></div><div className="mt-5 space-y-3">{data.orders.map((order) => <div className="rounded-2xl border border-orange-100 p-4" key={order.id}><div className="flex items-center justify-between"><span className="font-mono text-xs text-stone-500">#{order.id.slice(0, 8)}</span><span className="font-bold">{formatINR(Number(order.total))}</span></div><p className="mt-2 text-sm font-semibold capitalize">{String(order.status).replaceAll("_", " ")} · {order.payment_method}</p>{order.deliveryPhone && <p className="mt-2 text-sm text-stone-600">Delivery contact: <a className="font-semibold text-ink hover:underline" href={`tel:${order.deliveryPhone}`}>{order.deliveryPhone}</a></p>}{riders.length > 0 && <label className="mt-3 block text-xs font-bold uppercase tracking-wide text-stone-500">Assign rider<select className="mt-1 h-9 w-full rounded-lg border border-stone-200 bg-white px-2 text-sm font-normal text-ink" defaultValue={order.delivery_assignments?.[0]?.rider_id ?? ""} onChange={(event) => void assignRider(order.id, event.target.value)}><option value="">Choose a rider</option>{riders.map((rider) => <option key={rider.user_id} value={rider.user_id}>{rider.profiles?.display_name || rider.profiles?.email || rider.user_id.slice(0, 8)}</option>)}</select></label>}<div className="mt-3 flex flex-wrap gap-2">{nextStatuses(order.status).map((status) => <Button size="sm" variant="secondary" key={status} onClick={() => void updateOrder(order.id, status)}>{status.replaceAll("_", " ")}</Button>)}</div></div>)}{!data.orders.length && <p className="text-sm text-stone-600">Orders will appear here as soon as customers check out.</p>}</div></Card>
      </div>
    </div>
  </main>;
}

function MenuCategorySection({ category, expanded, restaurantId, categories, onToggle, onSaved, onMessage }: { category: AdminCategory; expanded: boolean; restaurantId: string; categories: AdminCategory[]; onToggle: () => void; onSaved: () => Promise<void>; onMessage: (message: string) => void }) {
  const itemCount = category.menu_items?.length ?? 0;
  const contentId = `menu-category-${category.id}`;

  return <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
    <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron" aria-expanded={expanded} aria-controls={contentId} onClick={onToggle}>
      <span className="min-w-0"><span className="block truncate font-bold text-ink">{category.name}</span><span className="mt-1 block text-xs text-stone-500">{itemCount} {itemCount === 1 ? "dish" : "dishes"}</span></span>
      {expanded ? <ChevronDown className="h-5 w-5 shrink-0 text-saffron" aria-hidden="true" /> : <ChevronRight className="h-5 w-5 shrink-0 text-saffron" aria-hidden="true" />}
    </button>
    {expanded && <div id={contentId} className="border-t border-orange-100 p-3">
      {itemCount ? <div className="grid gap-3">{category.menu_items?.map((menuItem) => <MenuItemEditor key={menuItem.id} restaurantId={restaurantId} item={menuItem} categories={categories} onSaved={onSaved} onMessage={onMessage} />)}</div> : <p className="rounded-xl bg-orange-50 px-3 py-4 text-sm text-stone-600">No dishes in this category yet. Add one above to start building the menu.</p>}
    </div>}
  </section>;
}

function MenuItemEditor({ restaurantId, item, categories, onSaved, onMessage }: { restaurantId: string; item: MenuItem; categories: AdminCategory[]; onSaved: () => Promise<void>; onMessage: (message: string) => void }) {
  const [draft, setDraft] = useState({ categoryId: item.category_id, name: item.name, description: item.description ?? "", price: String(item.price), vegetarian: item.vegetarian, active: item.active });
  const [saving, setSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/restaurants/${restaurantId}/menu`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, ...draft, price: Number(draft.price), description: draft.description || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Menu item could not be saved.");
      await onSaved();
      onMessage("Menu item saved.");
    } catch (error) { onMessage(error instanceof Error ? error.message : "Menu item could not be saved."); }
    finally { setSaving(false); }
  }

  async function uploadPhoto(photo: File) {
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", photo);
      const response = await fetch(`/api/admin/restaurants/${restaurantId}/menu/${item.id}/photo`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Food photo could not be uploaded.");
      await onSaved();
      onMessage("Food photo uploaded.");
    } catch (error) { onMessage(error instanceof Error ? error.message : "Food photo could not be uploaded."); }
    finally { setSaving(false); }
  }

  function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    event.target.value = "";
    if (photo) void uploadPhoto(photo);
  }

  return <form className="rounded-xl border border-orange-100 p-3" onSubmit={(event) => void save(event)}><div className="grid gap-4 md:grid-cols-2"><div className="min-w-0"><input ref={photoInputRef} className="sr-only" aria-label={`Choose photo for ${item.name}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /><button type="button" className="group relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-orange-50 text-orange-300 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 disabled:cursor-wait" onClick={() => photoInputRef.current?.click()} disabled={saving} aria-label={`Choose photo for ${item.name}`}>{item.image_url ? <img src={item.image_url} alt={`Photo of ${item.name}`} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><ImagePlus className="h-10 w-10" /></span>}<span className="absolute inset-0 grid place-items-center bg-ink/0 transition group-hover:bg-ink/35"><span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm font-semibold text-ink opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{saving ? "Uploading…" : "Change photo"}</span></span></button><p className="mt-2 text-xs text-stone-500">Click the photo to upload a JPEG, PNG, or WebP up to 5 MB.</p></div><div className="min-w-0"><div className="grid gap-2 sm:grid-cols-2"><Input aria-label="Item name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /><Input aria-label="Item price" type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /><select aria-label="Item category" className="h-10 rounded-xl border border-stone-200 bg-white px-3" value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input aria-label="Item description" placeholder="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div><div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold"><label className="flex items-center gap-2"><input type="checkbox" checked={draft.vegetarian} onChange={(event) => setDraft({ ...draft, vegetarian: event.target.checked })} />Vegetarian</label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />Visible to customers</label><Button type="submit" size="sm" disabled={saving}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Save</Button></div></div></div></form>;
}

function nextStatuses(status: string) {
  return ({ pending_approval: ["confirmed", "cancelled"], confirmed: ["preparing", "cancelled"], preparing: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"], pending_payment: [], delivered: [], cancelled: [] } as Record<string, string[]>)[status] ?? [];
}
