"use client";

import Link from "next/link";
import { ArrowLeft, LayoutDashboard, Leaf, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CartSheet } from "@/components/cart/cart-sheet";
import { AccountIndicator, type CustomerAccount } from "@/components/auth/account-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
import { useCartStore } from "@/store/useCartStore";
import { formatINR } from "@/lib/utils";
import type { MenuCategory, Restaurant } from "@/lib/types";

export function RestaurantStorefront({ slug }: { slug: string }) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const cartState = useCartStore();
  const nextPath = `/restaurants/${slug}`;
  const itemCount = account && restaurant ? (cartState.cartsByRestaurant[restaurant.id]?.lines.reduce((total, line) => total + line.quantity, 0) ?? 0) : 0;

  useEffect(() => {
    let live = true;
    async function load() {
      setLoading(true);
      try {
        const restaurantResponse = await fetch(`/api/restaurants?slug=${encodeURIComponent(slug)}`);
        const restaurantData = await restaurantResponse.json();
        if (!restaurantResponse.ok || !restaurantData) throw new Error(restaurantData?.error ?? "This restaurant is unavailable.");
        const menuResponse = await fetch(`/api/menu?restaurantId=${restaurantData.id}`);
        const menuData = await menuResponse.json();
        if (!menuResponse.ok) throw new Error(menuData.error ?? "Menu could not be loaded.");
        if (!live) return;
        setRestaurant(restaurantData);
        setCategories(menuData);
        setActiveCategory(menuData[0]?.id ?? null);
      } catch (loadError) { if (live) setError(loadError instanceof Error ? loadError.message : "Menu could not be loaded."); }
      finally { if (live) setLoading(false); }
    }
    void load();
    return () => { live = false; };
  }, [slug]);

  useEffect(() => { if (account && restaurant) cartState.selectRestaurant(restaurant.id); }, [account, restaurant?.id]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveCategory(visible.target.id.replace("category-", ""));
    }, { rootMargin: "-22% 0px -60% 0px", threshold: [0.05, 0.3] });
    Object.values(refs.current).forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, [categories]);

  function beginOrder(action: () => void) {
    if (!account) { router.push(`/?next=${encodeURIComponent(nextPath)}`); return; }
    action();
  }

  const menuItems = useMemo(() => categories.flatMap((category) => category.items), [categories]);
  if (loading) return <main className="min-h-screen bg-cream px-5 py-12"><div className="mx-auto max-w-6xl animate-pulse space-y-6"><div className="h-32 rounded-3xl bg-orange-100" /><div className="h-8 w-1/3 rounded bg-orange-100" /><div className="grid gap-5 md:grid-cols-2"><div className="h-56 rounded-3xl bg-orange-100" /><div className="h-56 rounded-3xl bg-orange-100" /></div></div></main>;
  if (!restaurant || error) return <main className="grid min-h-screen place-items-center bg-cream p-5"><Card className="max-w-md p-8 text-center"><h1 className="display-font text-3xl">Restaurant unavailable</h1><p className="mt-3 text-stone-600">{error ?? "This restaurant is no longer accepting orders."}</p><Link href="/restaurants" className="mt-6 inline-block font-semibold text-saffron">Back to restaurants</Link></Card></main>;

  return <main className="min-h-screen bg-cream pb-24"><header className="sticky top-0 z-30 border-b border-orange-100 bg-cream/90 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><Link href="/restaurants" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-700"><ArrowLeft className="h-4 w-4" />All restaurants</Link><div className="flex flex-wrap justify-end gap-2"><AccountIndicator nextPath={nextPath} onAccountChange={setAccount} />{account?.isRestaurantOwner && <Link href="/admin" className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white shadow-lg shadow-orange-950/10 transition hover:bg-[#442a1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2"><LayoutDashboard className="h-4 w-4" />Operations</Link>}{account ? <Button size="sm" onClick={() => cartState.setOpen(true)}><ShoppingBag className="h-4 w-4" />Cart {itemCount ? `(${itemCount})` : ""}</Button> : <Link href={`/?next=${encodeURIComponent(nextPath)}`} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">Sign in to order</Link>}</div></div></header><section className="mx-auto max-w-6xl px-5 pt-9"><div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink via-[#432418] to-saffron p-7 text-white sm:p-10"><p className="text-sm font-bold uppercase tracking-[.18em] text-orange-200">Independent kitchen</p><h1 className="display-font mt-3 text-4xl sm:text-6xl">{restaurant.name}</h1><p className="mt-4 max-w-2xl text-orange-50/80">{restaurant.description || "Freshly made favourites from a kitchen close to you."}</p><div className="mt-7 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-white/10 px-4 py-2"><MapPin className="mr-1 inline h-4 w-4" />{restaurant.delivery_radius_km} km delivery radius</span><span className="rounded-full bg-white/10 px-4 py-2">Base delivery from {formatINR(restaurant.delivery_fee_base)}</span></div></div></section>{categories.length === 0 ? <section className="mx-auto max-w-6xl px-5 py-14"><StatusNote>This restaurant is setting up its first menu. Please check back soon.</StatusNote></section> : <section className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[200px_1fr]"><aside className="lg:sticky lg:top-20 lg:h-fit"><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-stone-500">Menu</p><nav className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1">{categories.map((category) => <button key={category.id} onClick={() => document.getElementById(`category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition lg:block lg:w-full lg:text-left ${activeCategory === category.id ? "bg-ink text-white" : "bg-white text-stone-600 hover:bg-orange-100"}`}>{category.name}</button>)}</nav></aside><div className="space-y-12">{categories.map((category) => <section id={`category-${category.id}`} key={category.id} ref={(element) => { refs.current[category.id] = element; }} className="scroll-mt-28"><div className="mb-5"><h2 className="display-font text-3xl">{category.name}</h2>{category.description && <p className="mt-1 text-sm text-stone-600">{category.description}</p>}</div><div className="grid gap-4 sm:grid-cols-2">{category.items.map((item) => { const quantity = account ? (cartState.cartsByRestaurant[restaurant.id]?.lines.find((line) => line.itemId === item.id)?.quantity ?? 0) : 0; return <Card className="overflow-hidden p-0" key={item.id}>{item.image_url && <img src={item.image_url} alt="" className="h-40 w-full object-cover" />}<div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-bold text-ink">{item.name}</h3>{item.vegetarian && <Leaf className="h-4 w-4 text-moss" aria-label="Vegetarian" />}</div><p className="mt-2 min-h-10 text-sm leading-5 text-stone-600">{item.description || "Prepared fresh when you order."}</p></div><span className="whitespace-nowrap font-bold">{formatINR(item.price)}</span></div><div className="mt-5 flex justify-end">{quantity ? <div className="flex items-center gap-3 rounded-full bg-orange-100 p-1"><button aria-label={`Remove one ${item.name}`} className="grid h-8 w-8 place-items-center rounded-full bg-white" onClick={() => beginOrder(() => cartState.setQuantity(restaurant.id, item.id, quantity - 1))}><Minus className="h-4 w-4" /></button><span className="w-4 text-center text-sm font-bold">{quantity}</span><button aria-label={`Add one ${item.name}`} className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white" onClick={() => beginOrder(() => cartState.addItem(restaurant.id, item.id))}><Plus className="h-4 w-4" /></button></div> : <Button size="sm" variant="secondary" onClick={() => beginOrder(() => cartState.addItem(restaurant.id, item.id))}><Plus className="h-4 w-4" />{account ? "Add" : "Sign in to add"}</Button>}</div></div></Card>; })}</div></section>)}</div></section>}{account && <CartSheet restaurant={restaurant} items={menuItems} />}</main>;
}
