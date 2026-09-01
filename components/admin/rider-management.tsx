"use client";

import Link from "next/link";
import { LoaderCircle, MailPlus, RefreshCw, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";

type Rider = { userId: string; addedAt: string; displayName: string | null; email: string | null; active: boolean };

export function RiderManagement({ restaurantId }: { restaurantId: string }) {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/restaurants/${restaurantId}/riders`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Riders could not be loaded.");
    setRiders(payload.riders);
  }, [restaurantId]);

  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Riders could not be loaded.")).finally(() => setLoading(false)); }, [load]);

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviting(true); setMessage(null);
    try {
      const response = await fetch(`/api/admin/restaurants/${restaurantId}/riders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Rider invitation could not be sent.");
      setEmail("");
      setMessage(payload.invitationSent ? "Invitation sent. The rider will appear as active after account setup." : "Verified rider added to this restaurant.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Rider invitation could not be sent."); }
    finally { setInviting(false); }
  }

  return <main className="min-h-screen bg-cream px-5 py-8"><section className="mx-auto max-w-3xl"><Link href={`/admin/${restaurantId}`} className="text-sm font-semibold text-stone-600 hover:text-ink">← Operations</Link><header className="mt-7"><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Restaurant team</p><h1 className="display-font mt-2 text-4xl">Riders</h1><p className="mt-3 text-stone-600">Invite a delivery rider by email or give an existing verified account access immediately.</p></header>{message && <div className="mt-5"><StatusNote tone={message.includes("sent") || message.includes("added") ? "success" : "error"}>{message}</StatusNote></div>}<Card className="mt-6 p-6"><form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void invite(event)}><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="rider@example.com" /><Button type="submit" disabled={inviting}>{inviting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}Invite rider</Button></form><p className="mt-3 text-xs text-stone-500">New riders receive an account-setup email and are sent to the Rider Portal after accepting it.</p></Card><div className="mt-6 flex items-center justify-between"><h2 className="display-font text-2xl">Your riders</h2><Button size="sm" variant="secondary" disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div><div className="mt-4 grid gap-3">{riders.map((rider) => <Card className="flex items-center justify-between gap-4 p-5" key={rider.userId}><div><p className="font-bold">{rider.displayName || rider.email || "Invited rider"}</p><p className="mt-1 text-sm text-stone-600">{rider.email || "Email will appear after account setup."}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${rider.active ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}><UserRoundCheck className="h-3.5 w-3.5" />{rider.active ? "Active" : "Invitation pending"}</span></Card>)}{!loading && !riders.length && <Card className="p-6"><StatusNote>No riders have been invited yet.</StatusNote></Card>}</div></section></main>;
}
