import { NextRequest, NextResponse } from "next/server";
import { isVerifiedUser } from "@/lib/identity";
import { safeNextPath } from "@/lib/auth-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const error = request.nextUrl.searchParams.get("error_description") ?? request.nextUrl.searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/?authError=${encodeURIComponent(error)}`, request.url));

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/?authError=The+authentication+link+is+invalid+or+expired.", request.url));
  try {
    const supabase = await getSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user || !isVerifiedUser(data.user)) {
      return NextResponse.redirect(new URL("/?authError=Confirm+your+email+before+continuing.", request.url));
    }
    return NextResponse.redirect(new URL(next, request.url));
  } catch {
    return NextResponse.redirect(new URL("/?authError=We+could+not+complete+sign-in.+Please+try+again.", request.url));
  }
}
