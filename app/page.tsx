import { Suspense } from "react";
import { WelcomeExperience } from "@/components/auth/welcome-experience";

export default function WelcomePage() {
  return <Suspense fallback={<main className="min-h-screen bg-cream" />}><WelcomeExperience /></Suspense>;
}
