import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StaffAccess } from "@/components/auth/staff-access";
import { getOptionalSessionLanding } from "@/lib/session-routing";

export default async function StaffPage() {
  const destination = await getOptionalSessionLanding();
  if (destination) redirect(destination);
  return <Suspense fallback={<main className="min-h-screen bg-cream" />}><StaffAccess /></Suspense>;
}
