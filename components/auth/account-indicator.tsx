"use client";

import { LoaderCircle, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { signInUrl } from "@/lib/auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/useCartStore";

export type CustomerAccount = {
  email: string;
  displayName: string | null;
  defaultDeliveryPhone: string | null;
  isRestaurantOwner: boolean;
};

export function AccountIndicator({ nextPath, onAccountChange }: { nextPath: string; onAccountChange?: (account: CustomerAccount | null) => void }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const onAccountChangeRef = useRef(onAccountChange);
  useEffect(() => { onAccountChangeRef.current = onAccountChange; }, [onAccountChange]);

  useEffect(() => {
    let live = true;
    fetch("/api/customer-profile").then(async (response) => {
      if (!response.ok) return null;
      return response.json() as Promise<CustomerAccount>;
    }).then((data) => {
      if (!live) return;
      setProfile(data);
      setPhone(data?.defaultDeliveryPhone ?? "");
      setLoaded(true);
      onAccountChangeRef.current?.(data);
    }).catch(() => {
      if (!live) return;
      setLoaded(true);
      onAccountChangeRef.current?.(null);
    });
    return () => { live = false; };
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

  async function signOut() {
    setSaving(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      useCartStore.getState().clearAllCarts();
      onAccountChangeRef.current?.(null);
      router.replace("/");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-out could not be completed."); }
    finally { setSaving(false); }
  }

  if (!loaded) return <span className="h-9 w-20 animate-pulse rounded-full bg-orange-100" />;
  if (!profile) return <Link href={signInUrl(nextPath)} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-[#442a1d]">Sign in</Link>;
  return <div className="relative"><button className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-2 text-sm font-bold text-ink hover:bg-orange-200" onClick={() => setOpen((value) => !value)}><UserRound className="h-4 w-4" />Account</button>{open && <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-orange-100 bg-white p-4 shadow-xl"><p className="font-bold">{profile.displayName || "Your account"}</p><p className="mt-1 break-all text-xs text-stone-600">{profile.email}</p><p className="mt-3 text-xs leading-5 text-stone-600">Your delivery phone is used only as an order contact for the restaurant and assigned rider.</p><label className="mt-4 block text-sm font-semibold">Delivery phone<Input className="mt-2" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone.replace(/^\+91/, "")} onChange={(event) => setPhone(event.target.value)} disabled={saving} /></label>{message && <div className="mt-3"><StatusNote tone="error">{message}</StatusNote></div>}<Button className="mt-4 w-full" size="sm" onClick={() => void save()} disabled={saving}>{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Save delivery contact</Button><Button className="mt-2 w-full" size="sm" variant="ghost" onClick={() => void signOut()} disabled={saving}><LogOut className="h-4 w-4" />Sign out</Button></div>}</div>;
}
