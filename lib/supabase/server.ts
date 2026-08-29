import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { assertServerEnv, env, hasSupabaseConfig } from "@/lib/env";

type SupabaseCookie = { name: string; value: string; options: CookieOptions };

export async function getSupabaseServerClient() {
  if (!hasSupabaseConfig() || !env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase is not configured.");
  }
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(values: SupabaseCookie[]) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies; middleware refreshes sessions instead.
        }
      },
    },
  });
}

export function getSupabaseAdminClient() {
  assertServerEnv("supabaseUrl", "supabaseServiceRoleKey");
  return createClient(env.supabaseUrl!, env.supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
