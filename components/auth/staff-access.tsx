"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthAccessForm } from "@/components/auth/auth-access-form";
import { Card } from "@/components/ui/card";
import { cleanReturnPath } from "@/lib/auth-redirect";

export function StaffAccess() {
  const searchParams = useSearchParams();
  const next = cleanReturnPath(searchParams.get("next")) ?? (searchParams.get("restaurantId") ? cleanReturnPath(`/admin/${searchParams.get("restaurantId")}`) : null);
  return <main className="grid min-h-screen place-items-center bg-cream p-5"><Card className="w-full max-w-md p-7 sm:p-9"><Link href="/restaurants" className="inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-ink"><ArrowLeft className="h-4 w-4" />Browse restaurants</Link><div className="mt-7 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-xs font-bold uppercase tracking-[.16em] text-saffron">Restaurant team</p><h1 className="display-font text-3xl">Sign in or create an account</h1></div></div><p className="mt-4 text-sm leading-6 text-stone-600">Use a confirmed email/password account or Google. Restaurant owners, managers, and riders use the same secure access.</p><div className="mt-7"><AuthAccessForm nextPath={next} /></div></Card></main>;
}
