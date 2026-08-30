"use client";

import { ArrowLeft, CheckCircle2, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/env";

type Mode = "sign-in" | "sign-up" | "secure-account";

export function StaffAccess() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig()) return;
    getSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      setIsGuest(Boolean(data.user?.is_anonymous));
      setEmailVerified(Boolean(data.user?.email_confirmed_at));
      if (data.user?.email) setEmail(data.user.email);
      if (data.user?.email && data.user.email_confirmed_at) setMode("secure-account");
    });
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.localStorage.removeItem("chandigarh_guest_user_id");
        router.replace("/restaurants");
        return;
      }
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/staff` } });
        if (error) throw error;
        setMessage("Check your email to confirm the staff account. An owner can add you after confirmation.");
        return;
      }
      if (!emailVerified) {
        const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/staff` });
        if (error) throw error;
        setMessage("Check your email to confirm this account, then return here to set its password. Your restaurant access stays attached to this account.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Your guest account is now secured with email and password.");
      setIsGuest(false);
      window.localStorage.removeItem("chandigarh_guest_user_id");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Staff access could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const secureAccount = mode === "secure-account";
  return <main className="grid min-h-screen place-items-center bg-cream p-5"><Card className="w-full max-w-md p-7 sm:p-9"><Link href="/restaurants" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to restaurants</Link><div className="mt-7 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Restaurant team</p><h1 className="display-font text-3xl">Staff access</h1></div></div>{isGuest && <div className="mt-6 rounded-2xl bg-orange-50 p-4 text-sm text-stone-700"><p className="font-bold">Secure this guest account</p><p className="mt-1">Add a verified email and password to keep your owner access if this browser is cleared.</p><Button className="mt-3" size="sm" variant="secondary" onClick={() => setMode("secure-account")}>Secure my account</Button></div>}<form className="mt-7 space-y-4" onSubmit={(event) => void submit(event)}><label className="block text-sm font-semibold">Email address<Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="block text-sm font-semibold">{secureAccount && !emailVerified ? "Password (set after confirmation)" : "Password"}<Input className="mt-2" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required={!(secureAccount && !emailVerified)} disabled={secureAccount && !emailVerified} /></label>{message && <StatusNote tone={message.startsWith("Your") || message.startsWith("Check") ? "info" : "error"}>{message}</StatusNote>}<Button className="w-full" size="lg" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : secureAccount ? <CheckCircle2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}{mode === "sign-in" ? "Sign in as staff" : secureAccount ? (emailVerified ? "Set staff password" : "Send confirmation email") : "Create staff account"}</Button></form>{!secureAccount && <button className="mt-5 w-full text-sm font-semibold text-saffron hover:underline" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Need a staff account? Sign up" : "Already confirmed? Sign in"}</button>}</Card></main>;
}
