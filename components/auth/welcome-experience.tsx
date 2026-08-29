"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, LoaderCircle, Phone, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { hasSupabaseConfig } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeIndianPhone } from "@/lib/utils";

type Stage = "phone" | "otp";

export function WelcomeExperience() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/restaurants");
    });
  }, [router]);
  useEffect(() => {
    if (!leaving) return;
    const redirectAfterExit = window.setTimeout(() => router.replace("/restaurants"), 360);
    return () => window.clearTimeout(redirectAfterExit);
  }, [leaving, router]);

  async function sendOtp() {
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) {
      setMessage("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      setPhone(normalized);
      setStage("otp");
      window.setTimeout(() => otpRef.current?.focus(), 100);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not send the code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setMessage("Enter the six-digit code sent to your phone.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
      setLeaving(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That code is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5 py-10">
      <div className="absolute inset-0 scale-105 bg-[url('/images/food-hero.png')] bg-cover bg-center blur-[2px]" />
      <div className="hero-wash absolute inset-0" />
      <div className="glass-grid absolute inset-0 opacity-40" />
      <AnimatePresence mode="wait">
        {!leaving && (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative w-full max-w-md"
          >
            <Card className="p-7 sm:p-9">
              <div className="mb-8 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-saffron text-white"><Sparkles className="h-5 w-5" /></div>
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">Freshly made</p><p className="font-semibold text-ink">Chandigarh Fastfood</p></div>
              </div>
              {stage === "phone" ? (
                <section>
                  <p className="text-sm font-semibold text-moss">A better way to order local.</p>
                  <h1 className="display-font mt-2 text-4xl leading-tight text-ink sm:text-5xl">Welcome to Chandigarh Fastfood.</h1>
                  <p className="mt-4 leading-6 text-stone-600">Sign in with your phone to discover independent kitchens and track every delivery.</p>
                  <label className="mt-7 block text-sm font-semibold text-ink" htmlFor="phone">Mobile number</label>
                  <div className="mt-2 flex gap-2"><span className="grid h-12 place-items-center rounded-xl border border-stone-200 bg-stone-50 px-3 font-semibold">+91</span><Input id="phone" autoComplete="tel-national" inputMode="numeric" placeholder="98765 43210" value={phone.replace(/^\+91/, "")} onChange={(event) => setPhone(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendOtp(); }} /></div>
                  <p className="mt-2 text-xs text-stone-500">We’ll send a one-time verification code. Standard SMS rates may apply.</p>
                  {message && <div className="mt-4"><StatusNote tone="error">{message}</StatusNote></div>}
                  {!hasSupabaseConfig() && <div className="mt-4"><StatusNote>Demo shell is ready. Add the Supabase variables in <code>.env.local</code> to enable OTP.</StatusNote></div>}
                  <Button className="mt-6 w-full" size="lg" onClick={() => void sendOtp()} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}Continue with phone<ArrowRight className="h-4 w-4" /></Button>
                </section>
              ) : (
                <section>
                  <button className="text-sm font-semibold text-saffron hover:underline" onClick={() => { setStage("phone"); setOtp(""); setMessage(null); }}>Change number</button>
                  <h1 className="display-font mt-3 text-4xl text-ink">Check your messages.</h1>
                  <p className="mt-3 leading-6 text-stone-600">Enter the six-digit code sent to <strong>{phone}</strong>.</p>
                  <label className="mt-8 block text-sm font-semibold text-ink" htmlFor="otp">Verification code</label>
                  <div className="relative mt-2">
                    <div className="grid grid-cols-6 gap-2" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} className="grid aspect-square place-items-center rounded-xl border border-stone-200 bg-white text-lg font-bold">{otp[index] ?? ""}</span>)}</div>
                    <input ref={otpRef} id="otp" className="absolute inset-0 cursor-text opacity-0" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter") void verifyOtp(); }} />
                  </div>
                  {message && <div className="mt-4"><StatusNote tone="error">{message}</StatusNote></div>}
                  <Button className="mt-6 w-full" size="lg" onClick={() => void verifyOtp()} disabled={busy}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Verify and continue<ArrowRight className="h-4 w-4" /></Button>
                  <button className="mt-4 w-full text-sm font-semibold text-moss hover:underline" onClick={() => void sendOtp()} disabled={busy}>Resend code</button>
                </section>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
