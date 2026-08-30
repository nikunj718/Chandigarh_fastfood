"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthAccessForm } from "@/components/auth/auth-access-form";
import { Card } from "@/components/ui/card";
import { StatusNote } from "@/components/ui/status-note";
import { safeNextPath } from "@/lib/auth-redirect";

export function WelcomeExperience() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const authError = searchParams.get("authError");
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-cream px-5 py-10"><div className="absolute inset-0 scale-105 bg-[url('/images/food-hero.png')] bg-cover bg-center blur-[2px]" /><div className="hero-wash absolute inset-0" /><div className="glass-grid absolute inset-0 opacity-40" /><motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="relative w-full max-w-md"><Card className="p-7 sm:p-9"><div className="mb-8 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-saffron text-white"><Sparkles className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">Freshly made</p><p className="font-semibold text-ink">Fastfood Delivery</p></div></div><p className="text-sm font-semibold text-moss">A better way to order local.</p><h1 className="display-font mt-2 text-4xl leading-tight text-ink sm:text-5xl">Welcome to Fastfood Delivery.</h1><p className="mt-4 leading-6 text-stone-600">Sign in with Google or a confirmed email account to order, run a restaurant, or deliver orders.</p>{authError && <div className="mt-5"><StatusNote tone="error">{authError}</StatusNote></div>}<div className="mt-7"><AuthAccessForm nextPath={next} /></div><p className="mt-5 text-center text-sm text-stone-600">Just browsing? <Link href="/restaurants" className="font-semibold text-saffron hover:underline">Explore restaurants and menus</Link></p></Card></motion.div></main>;
}
