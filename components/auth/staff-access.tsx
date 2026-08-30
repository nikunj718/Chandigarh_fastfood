"use client";

import { ArrowLeft, CheckCircle2, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up" | "secure-account";
type SecureState = "unknown" | "email-unverified" | "ready";

export function StaffAccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restaurantId = searchParams.get("restaurantId");
  const awaitingConfirmation = searchParams.get("confirmation") === "1";
  const [mode, setMode] = useState<Mode>(() => awaitingConfirmation ? "secure-account" : "sign-in");
  const [secureState, setSecureState] = useState<SecureState>(() => awaitingConfirmation ? "email-unverified" : "unknown");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(() => awaitingConfirmation ? "Enter your owner Gmail to check its confirmation status." : null);
  const submissionInFlight = useRef(false);
  const confirmationAttempt = useRef<string | null>(null);

  function selectMode(nextMode: Mode) {
    if (busy) return;
    setMode(nextMode);
    setSecureState(nextMode === "secure-account" ? "unknown" : "unknown");
    setMessage(nextMode === "secure-account" ? "Enter your owner Gmail to secure the account." : null);
  }

  async function secureOwnerAccount() {
    const requestedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Open this page from your signed-in guest session to secure the owner account.");

    const currentEmail = data.user.email?.trim().toLowerCase();
    const emailVerified = Boolean(data.user.email_confirmed_at);
    if (!emailVerified) {
      setSecureState("email-unverified");
      if (currentEmail === requestedEmail) {
        setMessage("A confirmation link is already pending. Check your Gmail, then return here to set a password.");
        return;
      }
      if (confirmationAttempt.current === requestedEmail) {
        setMessage("A confirmation request is already pending. Check your Gmail before trying again.");
        return;
      }
      confirmationAttempt.current = requestedEmail;
      const { error: updateError } = await supabase.auth.updateUser(
        { email: requestedEmail },
        { emailRedirectTo: `${window.location.origin}/staff?restaurantId=${restaurantId ?? ""}&confirmation=1` },
      );
      if (updateError) {
        if (!/rate limit|too many requests|429/i.test(updateError.message)) confirmationAttempt.current = null;
        throw updateError;
      }
      setMessage("Check your Gmail to confirm the owner account. Your restaurant access remains active.");
      return;
    }

    if (currentEmail !== requestedEmail) throw new Error("Use the verified email linked to this owner account.");
    if (!password) {
      setSecureState("ready");
      setMessage("Email is confirmed. Enter a password, then submit once more to secure this account.");
      return;
    }
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) throw passwordError;
    setSecureState("ready");
    window.localStorage.removeItem("chandigarh_guest_user_id");
    setMessage("Your guest account is now secured with email and password.");
    if (restaurantId) router.replace(`/admin/${restaurantId}`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.localStorage.removeItem("chandigarh_guest_user_id");
        router.replace(restaurantId ? `/admin/${restaurantId}` : "/restaurants");
        return;
      }
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/staff` } });
        if (error) throw error;
        setMessage("Check your email to confirm the staff account. An owner can add you after confirmation.");
        return;
      }
      await secureOwnerAccount();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Staff access could not be completed.");
    } finally {
      submissionInFlight.current = false;
      setBusy(false);
    }
  }

  const secureAccount = mode === "secure-account";
  const statusTone = message?.startsWith("Your") || message?.startsWith("Check") || message?.startsWith("Email") || message?.startsWith("A confirmation") ? "info" : "error";
  const passwordIsOptional = secureAccount && secureState !== "ready";
  return <main className="grid min-h-screen place-items-center bg-cream p-5"><Card className="w-full max-w-md p-7 sm:p-9"><Link href="/restaurants" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to restaurants</Link><div className="mt-7 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Restaurant team</p><h1 className="display-font text-3xl">Staff access</h1></div></div><div className="mt-6 rounded-2xl bg-orange-50 p-4 text-sm text-stone-700"><p className="font-bold">Restaurant owner?</p><p className="mt-1">Use this action to secure the guest account that created your restaurant. It only checks your session after you submit.</p><Button className="mt-3" size="sm" variant="secondary" disabled={busy} onClick={() => selectMode("secure-account")}>Secure owner account</Button></div><form className="mt-7 space-y-4" onSubmit={(event) => void submit(event)}><label className="block text-sm font-semibold">Email address<Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /></label><label className="block text-sm font-semibold">{secureAccount && secureState !== "ready" ? "Password (set after email confirmation)" : "Password"}<Input className="mt-2" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required={!passwordIsOptional} disabled={busy} /></label>{message && <StatusNote tone={statusTone}>{message}</StatusNote>}<Button className="w-full" size="lg" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : secureAccount ? <CheckCircle2 className="h-4 w-4" /> : <Mail className="h-4 w-4" />}{mode === "sign-in" ? "Sign in as staff" : secureAccount ? (secureState === "ready" ? "Set staff password" : "Check owner account") : "Create staff account"}</Button></form>{!secureAccount && <button className="mt-5 w-full text-sm font-semibold text-saffron hover:underline disabled:opacity-50" disabled={busy} onClick={() => selectMode(mode === "sign-in" ? "sign-up" : "sign-in")}>{mode === "sign-in" ? "Need a staff account? Sign up" : "Already confirmed? Sign in"}</button>}</Card></main>;
}
