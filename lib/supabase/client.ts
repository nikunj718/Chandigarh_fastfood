"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env, hasSupabaseConfig } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig() || !env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  browserClient ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return browserClient;
}
