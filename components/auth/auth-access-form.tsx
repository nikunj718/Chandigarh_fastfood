"use client";

import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusNote } from "@/components/ui/status-note";
import { authCallbackUrl, safeReturnPath } from "@/lib/auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export function AuthAccessForm({ nextPath }: { nextPath?: string | null }) {
  const router = useRouter();
  const next = safeReturnPath(nextPath);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const resendAttempt = useRef<string | null>(null);

  function callbackUrl() {
    return authCallbackUrl(window.location.origin, next);
  }

  async function withLock(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication could not be completed.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    await withLock(async () => {
      const { data, error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (error || !data.url) throw error ?? new Error("Google sign-in could not be started.");
      window.location.assign(data.url);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await withLock(async () => {
      const supabase = getSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "sign-in") {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        if (!data.user?.email_confirmed_at) {
          setConfirmationPending(true);
          throw new Error("Confirm your email before signing in.");
        }
        router.replace(next ?? "/");
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) throw error;
      if (data.session && data.user?.email_confirmed_at) {
        router.replace(next ?? "/");
        return;
      }
      setConfirmationPending(true);
      setMessage("Check your email to confirm your account, then return here to sign in.");
    });
  }

  async function resendConfirmation() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || resendAttempt.current === normalizedEmail) return;
    resendAttempt.current = normalizedEmail;
    await withLock(async () => {
      const { error } = await getSupabaseBrowserClient().auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo: callbackUrl() },
      });
      if (error) {
        if (!/rate limit|too many requests|429/i.test(error.message)) resendAttempt.current = null;
        throw error;
      }
      setMessage("A confirmation email has been sent. Check your inbox before signing in.");
    });
  }

  return <div className="space-y-4"><Button className="w-full" size="lg" variant="secondary" disabled={busy} type="button" onClick={() => void signInWithGoogle()}><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-black text-[#4285f4]">G</span>Sign in with Google</Button><div className="flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div><form className="space-y-4" onSubmit={(event) => void submit(event)}><label className="block text-sm font-semibold">Email address<Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /></label><label className="block text-sm font-semibold">Password<Input className="mt-2" type="password" minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} /></label>{message && <StatusNote tone={message.startsWith("Check") || message.startsWith("A confirmation") ? "info" : "error"}>{message}</StatusNote>}<Button className="w-full" size="lg" type="submit" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : mode === "sign-in" ? <Mail className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{mode === "sign-in" ? "Sign in with email" : "Create account"}</Button></form>{confirmationPending && <Button className="w-full" variant="ghost" size="sm" type="button" disabled={busy || !email.trim() || resendAttempt.current === email.trim().toLowerCase()} onClick={() => void resendConfirmation()}>Resend confirmation email</Button>}<button className="w-full text-sm font-semibold text-saffron hover:underline disabled:opacity-50" type="button" disabled={busy} onClick={() => { setMode((current) => current === "sign-in" ? "sign-up" : "sign-in"); setConfirmationPending(false); setMessage(null); }}>{mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}</button></div>;
}
