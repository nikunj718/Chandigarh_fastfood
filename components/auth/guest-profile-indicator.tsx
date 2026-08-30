"use client";

import { LoaderCircle, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";

type CustomerProfile = { isGuest: boolean; defaultDeliveryPhone: string | null };

export function GuestProfileIndicator() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customer-profile").then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<CustomerProfile>;
    }).then((data) => { setProfile(data); setPhone(data.defaultDeliveryPhone ?? ""); }).catch(() => setMessage("Delivery contact is unavailable right now."));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/customer-profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deliveryPhone: phone }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Delivery contact could not be saved.");
      setPhone(payload.deliveryPhone);
      setProfile((current) => current ? { ...current, defaultDeliveryPhone: payload.deliveryPhone } : current);
      setOpen(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Delivery contact could not be saved."); }
    finally { setSaving(false); }
  }

  if (!profile) return null;
  return <div className="relative"><button className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-2 text-sm font-bold text-ink hover:bg-orange-200" onClick={() => setOpen((value) => !value)}><UserRound className="h-4 w-4" />{profile.isGuest ? "Guest" : "Account"}</button>{open && <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-orange-100 bg-white p-4 shadow-xl"><p className="font-bold">{profile.isGuest ? "Browsing as guest" : "Delivery contact"}</p><p className="mt-1 text-xs leading-5 text-stone-600">This is a delivery contact only. It does not verify or link a phone to your account.</p><label className="mt-4 block text-sm font-semibold">Delivery phone<Input className="mt-2" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone.replace(/^\+91/, "")} onChange={(event) => setPhone(event.target.value)} /></label>{message && <div className="mt-3"><StatusNote tone="error">{message}</StatusNote></div>}<Button className="mt-4 w-full" size="sm" onClick={() => void save()} disabled={saving}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Save delivery contact</Button></div>}</div>;
}
