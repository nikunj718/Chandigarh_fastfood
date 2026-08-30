import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, hasSupabaseConfig } from "@/lib/env";
import { isVerifiedUser } from "@/lib/identity";
import { returnPathFromRequest } from "@/lib/auth-redirect";

type SupabaseCookie = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  if (!hasSupabaseConfig() || !env.supabaseUrl || !env.supabaseAnonKey) {
    return request.nextUrl.pathname === "/" ? NextResponse.next({ request }) : NextResponse.redirect(new URL("/", request.url));
  }
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
  if (!user || !isVerifiedUser(user)) {
    if (request.nextUrl.pathname === "/" || request.nextUrl.pathname === "/staff") return response;
    const loginUrl = new URL("/", request.url);
    const next = returnPathFromRequest(request.nextUrl.pathname, request.nextUrl.search);
    if (next) loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = { matcher: ["/", "/staff", "/admin", "/admin/:path*", "/rider", "/rider/:path*", "/tracking", "/tracking/:path*"] };
