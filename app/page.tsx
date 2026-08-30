import { Suspense } from "react";
import { redirect } from "next/navigation";
import { WelcomeExperience } from "@/components/auth/welcome-experience";
import { getOptionalSessionLanding } from "@/lib/session-routing";

export default async function WelcomePage() {
  const destination = await getOptionalSessionLanding();
  if (destination) redirect(destination);
  return <Suspense fallback={<main className="min-h-screen bg-cream" />}><WelcomeExperience /></Suspense>;
}
