"use client";

import { Check, ChevronRight, LoaderCircle, MapPin, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { useCartStore } from "@/store/useCartStore";
import { formatINR } from "@/lib/utils";
import type { Address, DeliveryQuote, MenuItem, Restaurant } from "@/lib/types";

type Suggestion = { id: string; addressText: string; latitude: number; longitude: number };

export function CartSheet({ restaurant, items }: { restaurant: Restaurant; items: MenuItem[] }) {
  const router = useRouter();
  const cartState = useCartStore();
  const cart = cartState.cartsByRestaurant[restaurant.id];
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checkoutId = useRef<string | null>(null);
  const validLines = useMemo(() => (cart?.lines ?? []).map((line) => ({ ...line, item: items.find((item) => item.id === line.itemId) })).filter((line): line is { itemId: string; quantity: number; item: MenuItem } => Boolean(line.item)), [cart, items]);
  const subtotal = Number(validLines.reduce((total, line) => total + line.item.price * line.quantity, 0).toFixed(2));

  useEffect(() => { if (cartState.open) void loadAddresses(); }, [cartState.open]);
  useEffect(() => {
    if (!cartState.open || !selectedAddressId || !validLines.length) return;
    let current = true;
    setQuote(null);
    fetch("/api/delivery-quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: restaurant.id, addressId: selectedAddressId }) }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Delivery is unavailable.");
      if (current) setQuote(payload);
    }).catch((error) => { if (current) setMessage(error instanceof Error ? error.message : "Delivery quote could not be calculated."); });
    return () => { current = false; };
  }, [cartState.open, selectedAddressId, restaurant.id, validLines.length]);
  async function loadAddresses() {
    const [response, profileResponse] = await Promise.all([fetch("/api/addresses"), fetch("/api/customer-profile")]);
    const [payload, profile] = await Promise.all([response.json(), profileResponse.json()]);
    if (!response.ok) { setMessage(payload.error ?? "Addresses could not be loaded."); return; }
    setAddresses(payload);
    setSelectedAddressId((current) => current || payload[0]?.id || "");
    if (profileResponse.ok) setDeliveryPhone(profile.defaultDeliveryPhone ?? "");
  }
  async function searchAddress() {
    if (addressQuery.trim().length < 3) { setSuggestions([]); setMessage("Enter at least three characters to find an address."); return; }
    setSearchingAddress(true); setMessage(null);
    try {
      const response = await fetch(`/api/address-search?q=${encodeURIComponent(addressQuery)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Address search could not be completed.");
      setSuggestions(payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Address search could not be completed."); }
    finally { setSearchingAddress(false); }
  }
  async function saveAddress(suggestion: Suggestion) {
    const response = await fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Delivery address", addressText: suggestion.addressText, latitude: suggestion.latitude, longitude: suggestion.longitude, isDefault: addresses.length === 0 }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Address could not be saved."); return; }
    setAddresses((current) => [payload, ...current.map((address) => payload.is_default ? { ...address, is_default: false } : address)]);
    setSelectedAddressId(payload.id); setAddressQuery(""); setSuggestions([]);
  }
  async function checkout() {
    if (!selectedAddressId || !validLines.length) return;
    setLoading(true); setMessage(null);
    try {
      checkoutId.current ??= crypto.randomUUID();
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantId: restaurant.id, addressId: selectedAddressId, paymentMethod, idempotencyKey: checkoutId.current, deliveryPhone, lines: validLines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Checkout could not be completed.");
      if (paymentMethod === "cod") { cartState.clearCart(restaurant.id); checkoutId.current = null; router.push(`/tracking/${payload.orderId}`); return; }
      await openRazorpay(payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout could not be completed."); }
    finally { setLoading(false); }
  }
  async function openRazorpay(payload: { orderId: string; total: number; razorpayOrderId: string; razorpayKeyId: string }) {
    await loadRazorpay();
    const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
    if (!Razorpay) throw new Error("Razorpay checkout could not be loaded.");
    new Razorpay({ key: payload.razorpayKeyId, amount: Math.round(payload.total * 100), currency: "INR", name: restaurant.name, order_id: payload.razorpayOrderId, prefill: { contact: deliveryPhone }, handler: () => { cartState.clearCart(restaurant.id); checkoutId.current = null; router.push(`/tracking/${payload.orderId}`); }, theme: { color: "#dc6b20" } }).open();
  }

  const total = subtotal + (quote?.fee ?? 0);
  return <>{cartState.open && <><button aria-label="Close cart" className="fixed inset-0 z-40 bg-black/35" onClick={() => cartState.setOpen(false)} /><aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream shadow-2xl"><div className="flex items-center justify-between border-b border-orange-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-saffron">Your order</p><h2 className="display-font text-2xl">{restaurant.name}</h2></div><button className="rounded-full p-2 hover:bg-orange-100" onClick={() => cartState.setOpen(false)}><X /></button></div><div className="flex-1 overflow-y-auto px-6 py-5">{!validLines.length ? <div className="py-14 text-center text-stone-600">Your cart is waiting for something delicious.</div> : <><div className="space-y-4">{validLines.map((line) => <div className="flex items-center justify-between gap-3" key={line.itemId}><div><p className="font-semibold">{line.item.name}</p><p className="text-sm text-stone-500">{formatINR(line.item.price)} each</p></div><div className="flex items-center gap-2 rounded-full bg-orange-100 p-1"><button className="grid h-7 w-7 place-items-center rounded-full bg-white" onClick={() => cartState.setQuantity(restaurant.id, line.itemId, line.quantity - 1)}><Minus className="h-3 w-3" /></button><span className="w-4 text-center text-sm font-bold">{line.quantity}</span><button className="grid h-7 w-7 place-items-center rounded-full bg-ink text-white" onClick={() => cartState.addItem(restaurant.id, line.itemId)}><Plus className="h-3 w-3" /></button></div></div>)}</div><div className="mt-7 border-t border-orange-100 pt-5"><label className="text-sm font-bold">Delivery address</label>{addresses.length ? <select className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3" value={selectedAddressId} onChange={(event) => setSelectedAddressId(event.target.value)}>{addresses.map((address) => <option key={address.id} value={address.id}>{address.address_text}</option>)}</select> : null}<div className="relative mt-3"><div className="flex gap-2"><Input placeholder="Enter your delivery address" value={addressQuery} onChange={(event) => { setAddressQuery(event.target.value); setSuggestions([]); }} /><Button type="button" size="sm" disabled={searchingAddress} onClick={() => void searchAddress()}>{searchingAddress ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Find"}</Button></div>{suggestions.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">{suggestions.map((suggestion) => <button className="block w-full border-b border-stone-100 px-3 py-3 text-left text-sm hover:bg-orange-50" key={suggestion.id} onClick={() => void saveAddress(suggestion)}>{suggestion.addressText}</button>)}</div>}</div><label className="mt-4 block text-sm font-bold">Delivery phone number<Input className="mt-2" required inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={deliveryPhone.replace(/^\+91/, "")} onChange={(event) => setDeliveryPhone(event.target.value)} /></label><p className="mt-1 text-xs text-stone-500">Required for the restaurant and assigned rider. We remember it as a delivery contact, not account identity.</p></div><div className="mt-6"><p className="text-sm font-bold">Payment</p><div className="mt-2 grid grid-cols-2 gap-2"><button className={`rounded-xl border p-3 text-left text-sm font-semibold ${paymentMethod === "cod" ? "border-saffron bg-orange-50" : "border-stone-200 bg-white"}`} onClick={() => setPaymentMethod("cod")}>Cash on delivery</button><button className={`rounded-xl border p-3 text-left text-sm font-semibold ${paymentMethod === "razorpay" ? "border-saffron bg-orange-50" : "border-stone-200 bg-white"}`} onClick={() => setPaymentMethod("razorpay")}>Pay online</button></div></div>{message && <div className="mt-4"><StatusNote tone="error">{message}</StatusNote></div>}</>}</div><div className="border-t border-orange-100 bg-white px-6 py-5">{validLines.length > 0 && <><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div><div className="flex justify-between"><span>Delivery {quote ? `(${quote.distanceKm} km)` : ""}</span><span>{quote ? formatINR(quote.fee) : "Calculating…"}</span></div><div className="flex justify-between pt-2 text-base font-bold"><span>Total</span><span>{formatINR(total)}</span></div></div><Button className="mt-5 w-full" size="lg" disabled={!selectedAddressId || !quote || !deliveryPhone.trim() || loading} onClick={() => void checkout()}>{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{paymentMethod === "cod" ? "Place COD order" : "Continue to Razorpay"}<ChevronRight className="h-4 w-4" /></Button><p className="mt-2 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3 w-3" />Delivery is verified from your chosen address.</p></>}</div></aside></>}</>;
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if ((window as Window & { Razorpay?: unknown }).Razorpay) { resolve(); return; }
    const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Razorpay checkout could not be loaded.")); document.body.appendChild(script);
  });
}
