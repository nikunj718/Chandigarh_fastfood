import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, hasSupabaseConfig } from "@/lib/env";

type SupabaseCookie = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  if (!hasSupabaseConfig() || !env.supabaseUrl || !env.supabaseAnonKey) return NextResponse.redirect(new URL("/", request.url));
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies: SupabaseCookie[]) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = { matcher: ["/restaurants/:path*", "/admin/:path*", "/rider/:path*", "/tracking/:path*"] };
