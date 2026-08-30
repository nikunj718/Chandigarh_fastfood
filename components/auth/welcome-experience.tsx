"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
import { hasSupabaseConfig } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const GUEST_MARKER = "chandigarh_guest_user_id";

export function WelcomeExperience() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [leaving, setLeaving] = useState(false);

  async function beginGuestSession() {
    if (!hasSupabaseConfig()) {
      setMessage("Supabase is not configured yet. Add the public Supabase settings to continue.");
      setBusy(false);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const storedGuestId = window.localStorage.getItem(GUEST_MARKER);
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session ? (await supabase.auth.getUser()).data.user : null;
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) throw error ?? new Error("Guest session could not be created.");
        user = data.user;
      }
      if (user.is_anonymous) {
        if (storedGuestId !== user.id) window.localStorage.setItem(GUEST_MARKER, user.id);
      } else {
        window.localStorage.removeItem(GUEST_MARKER);
      }
      setLeaving(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not start a guest session. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void beginGuestSession(); }, []);
  useEffect(() => {
    if (!leaving) return;
    const redirectAfterExit = window.setTimeout(() => router.replace("/restaurants"), 360);
    return () => window.clearTimeout(redirectAfterExit);
  }, [leaving, router]);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5 py-10">
      <div className="absolute inset-0 scale-105 bg-[url('/images/food-hero.png')] bg-cover bg-center blur-[2px]" />
      <div className="hero-wash absolute inset-0" />
      <div className="glass-grid absolute inset-0 opacity-40" />
      <AnimatePresence mode="wait">
        {!leaving && <motion.div key="guest-entry" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35, ease: "easeOut" }} className="relative w-full max-w-md">
          <Card className="p-7 sm:p-9">
            <div className="mb-8 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-saffron text-white"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">Freshly made</p><p className="font-semibold text-ink">Fastfood Delivery</p></div></div>
            <p className="text-sm font-semibold text-moss">A better way to order local.</p>
            <h1 className="display-font mt-2 text-4xl leading-tight text-ink sm:text-5xl">Welcome to Fastfood Delivery.</h1>
            <p className="mt-4 leading-6 text-stone-600">Preparing a private guest session so you can browse kitchens and build an order immediately.</p>
            {message && <div className="mt-5"><StatusNote tone="error">{message}</StatusNote></div>}
            <Button className="mt-7 w-full" size="lg" onClick={() => void beginGuestSession()} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}{busy ? "Starting guest session…" : "Continue as guest"}</Button>
            <p className="mt-5 text-center text-sm text-stone-600">Restaurant staff? <Link href="/staff" className="font-semibold text-saffron hover:underline">Use staff access</Link></p>
          </Card>
        </motion.div>}
      </AnimatePresence>
    </main>
  );
}
