import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getManagedRestaurants } from "@/lib/session-routing";
import { Card } from "@/components/ui/card";

export default async function AdminPickerPage() {
  const { supabase, user } = await requireUser();
  const restaurants = await getManagedRestaurants(supabase, user.id, user.email);
  if (restaurants.length === 0) redirect("/restaurants");
  if (restaurants.length === 1) redirect(`/admin/${restaurants[0].id}`);

  return <main className="min-h-screen bg-cream px-5 py-10"><section className="mx-auto max-w-4xl"><Link href="/restaurants" className="text-sm font-semibold text-stone-600 hover:text-ink">← Browse restaurants</Link><div className="mt-8"><p className="text-sm font-bold uppercase tracking-[.18em] text-saffron">Operations</p><h1 className="display-font mt-2 text-4xl text-ink sm:text-5xl">Choose a restaurant to manage</h1><p className="mt-3 text-stone-600">You have management access to more than one restaurant.</p></div><div className="mt-8 grid gap-4 sm:grid-cols-2">{restaurants.map((restaurant) => <Link key={restaurant.id} href={`/admin/${restaurant.id}`} className="group"><Card className="h-full p-6 transition group-hover:-translate-y-1 group-hover:shadow-xl"><div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white"><Store className="h-5 w-5" /></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${restaurant.active ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}>{restaurant.active ? "Accepting orders" : "Orders paused"}</span></div><h2 className="display-font mt-6 text-2xl text-ink">{restaurant.name}</h2><p className="mt-2 min-h-10 text-sm text-stone-600">{restaurant.addressText || "Restaurant location not set"}</p><div className="mt-6 flex items-center gap-2 text-sm font-bold text-saffron"><LayoutDashboard className="h-4 w-4" />Open {restaurant.role} operations</div></Card></Link>)}</div></section></main>;
}
