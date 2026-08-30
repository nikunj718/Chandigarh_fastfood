"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Compass, LoaderCircle, MapPin, Plus, Store, UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";
import { GuestProfileIndicator } from "@/components/auth/guest-profile-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { formatINR } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Address, Restaurant } from "@/lib/types";

type DirectoryRestaurant = Restaurant & { approximateDistanceKm: number | null };
type AddressSuggestion = { id: string; addressText: string; latitude: number; longitude: number };
const StoreLocationPicker = dynamic(() => import("@/components/maps/store-location-picker").then((module) => module.StoreLocationPicker), {
  ssr: false,
  loading: () => <StatusNote>Loading the store pin picker…</StatusNote>,
});

export function RestaurantDirectory() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<DirectoryRestaurant[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchingStoreAddress, setSearchingStoreAddress] = useState(false);
  const [draft, setDraft] = useState({ name: "", slug: "", ownerName: "", ownerEmail: "", addressText: "", latitude: null as number | null, longitude: null as number | null });

  async function load(addressId = selectedAddressId) {
    setLoading(true);
    try {
      const [restaurantsResponse, addressesResponse] = await Promise.all([fetch(`/api/restaurants${addressId ? `?addressId=${addressId}` : ""}`), fetch("/api/addresses")]);
      const [restaurantPayload, addressPayload] = await Promise.all([restaurantsResponse.json(), addressesResponse.json()]);
      if (!restaurantsResponse.ok) throw new Error(restaurantPayload.error);
      setRestaurants(restaurantPayload);
      if (addressesResponse.ok) {
        setAddresses(addressPayload);
        if (!selectedAddressId && addressPayload[0]) setSelectedAddressId(addressPayload[0].id);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "The restaurant directory could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (selectedAddressId) void load(selectedAddressId); }, [selectedAddressId]);
  function chooseStoreAddress(suggestion: AddressSuggestion) {
    setAddressQuery(suggestion.addressText);
    setAddressSuggestions([]);
    setDraft((current) => ({ ...current, addressText: suggestion.addressText, latitude: suggestion.latitude, longitude: suggestion.longitude }));
  }

  async function searchStoreAddress() {
    if (addressQuery.trim().length < 3) { setAddressSuggestions([]); setError("Enter at least three characters to find a restaurant address."); return; }
    setSearchingStoreAddress(true); setError(null);
    try {
      const response = await fetch(`/api/address-search?q=${encodeURIComponent(addressQuery)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Address search could not be completed.");
      setAddressSuggestions(payload);
    } catch (error) { setError(error instanceof Error ? error.message : "Address search could not be completed."); }
    finally { setSearchingStoreAddress(false); }
  }

  async function createRestaurant(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!draft.addressText || draft.latitude === null || draft.longitude === null) {
      setError("Choose your restaurant address from the search results, then confirm the map pin.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your guest session is unavailable. Refresh and try again.");
      if (authData.user.is_anonymous) {
        const { error: linkError } = await supabase.auth.updateUser(
          { email: draft.ownerEmail, data: { full_name: draft.ownerName } },
          { emailRedirectTo: `${window.location.origin}/staff?confirmation=1` },
        );
        if (linkError) throw new Error(`We could not link that Gmail address: ${linkError.message}`);
      }
      const response = await fetch("/api/restaurants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Restaurant could not be created.");
      if (payload.membershipRole !== "owner") throw new Error("Your owner access could not be confirmed.");
      router.replace(`/admin/${payload.id}`);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "Restaurant could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-cream">
    <header className="border-b border-orange-100 bg-white/80 px-5 py-5 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><Link href="/restaurants" className="flex items-center gap-2 font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-saffron text-white"><UtensilsCrossed className="h-4 w-4" /></span>Fastfood Delivery</Link><div className="flex items-center gap-2"><GuestProfileIndicator /><Button size="sm" variant="secondary" onClick={() => setCreating((value) => !value)}><Plus className="h-4 w-4" />Open a restaurant</Button></div></div></header>
    <section className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-sm font-bold uppercase tracking-[.18em] text-saffron">Choose your kitchen</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h1 className="display-font text-4xl sm:text-5xl">What are you in the mood for?</h1><p className="mt-3 max-w-xl text-stone-600">Independent kitchens across India, each with their own menu, radius, and delivery team.</p></div>
        {addresses.length > 0 && <label className="min-w-56 text-sm font-semibold">Delivery location<select className="mt-2 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 font-normal" value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}>{addresses.map((address) => <option key={address.id} value={address.id}>{address.label} — {address.address_text}</option>)}</select></label>}
      </div>
      {!addresses.length && !loading && <div className="mt-7"><StatusNote>Save a delivery address from a restaurant’s cart to see approximate distances here.</StatusNote></div>}
      {error && <div className="mt-6"><StatusNote tone="error">{error}</StatusNote></div>}
      {creating && <Card className="mt-8 p-6"><form onSubmit={(event) => void createRestaurant(event)}><h2 className="display-font text-2xl">Start your restaurant</h2><p className="mt-1 text-sm text-stone-600">Publish from any city in India. Find your address, then confirm the pin—no latitude or longitude needed.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Input required placeholder="Official restaurant name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value, slug: draft.slug || event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })} /><Input required placeholder="Restaurant username" aria-label="Restaurant username" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} /><Input required placeholder="Owner full name" autoComplete="name" value={draft.ownerName} onChange={(event) => setDraft({ ...draft, ownerName: event.target.value })} /><Input required type="email" pattern=".+@gmail\.com" placeholder="Owner Gmail address" autoComplete="email" value={draft.ownerEmail} onChange={(event) => setDraft({ ...draft, ownerEmail: event.target.value.toLowerCase() })} /><div className="relative sm:col-span-2"><div className="flex gap-2"><Input required placeholder="Enter restaurant address or locality in any Indian city" value={addressQuery} onChange={(event) => { setAddressQuery(event.target.value); setAddressSuggestions([]); setDraft((current) => ({ ...current, addressText: "", latitude: null, longitude: null })); }} /><Button type="button" size="sm" disabled={searchingStoreAddress || submitting} onClick={() => void searchStoreAddress()}>{searchingStoreAddress ? "Finding…" : "Find"}</Button></div>{addressSuggestions.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">{addressSuggestions.map((suggestion) => <button type="button" className="block w-full border-b border-stone-100 px-4 py-3 text-left text-sm hover:bg-orange-50" key={suggestion.id} onClick={() => chooseStoreAddress(suggestion)}>{suggestion.addressText}</button>)}</div>}</div></div>{draft.latitude !== null && draft.longitude !== null && <div className="mt-5"><p className="text-sm font-bold">Confirm store pin</p><StoreLocationPicker latitude={draft.latitude} longitude={draft.longitude} onChange={({ latitude, longitude }) => setDraft((current) => ({ ...current, latitude, longitude }))} /><p className="mt-2 text-xs text-stone-500">Your selected address is saved; drag the pin only if the exact storefront entrance differs.</p></div>}<Button className="mt-5" type="submit" disabled={submitting}><Store className="h-4 w-4" />{submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" />Opening operations…</> : "Create and open operations"}</Button></form></Card>}
      <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl bg-orange-100" />) : restaurants.map((restaurant) => <Link href={`/restaurants/${restaurant.slug}`} key={restaurant.id} className="group"><Card className="h-full overflow-hidden p-0 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-2xl"><div className="flex h-32 items-end bg-gradient-to-br from-orange-300 via-amber-100 to-moss p-5"><span className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-ink">{restaurant.approximateDistanceKm ? `≈ ${restaurant.approximateDistanceKm} km away` : "Delivery available"}</span></div><div className="p-6"><h2 className="display-font text-2xl">{restaurant.name}</h2><p className="mt-2 line-clamp-2 min-h-10 text-sm text-stone-600">{restaurant.description || restaurant.address_text || "A local kitchen waiting to be discovered."}</p>{restaurant.owner_name && <p className="mt-3 text-sm text-stone-500">Owned by {restaurant.owner_name}</p>}<div className="mt-5 flex items-center justify-between text-sm"><span className="flex items-center gap-1 text-moss"><MapPin className="h-4 w-4" />{restaurant.delivery_radius_km} km radius</span><span className="font-semibold">from {formatINR(restaurant.delivery_fee_base)}</span></div></div></Card></Link>)}</div>
      {!loading && restaurants.length === 0 && <div className="mt-12 rounded-3xl border border-dashed border-orange-200 bg-white/60 p-12 text-center"><Compass className="mx-auto h-8 w-8 text-saffron" /><h2 className="display-font mt-4 text-2xl">No restaurants are live yet.</h2><p className="mt-2 text-stone-600">Be the first to open one for your neighbourhood.</p></div>}
    </section>
  </main>;
}
