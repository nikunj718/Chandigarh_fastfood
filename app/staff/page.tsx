import { Suspense } from "react";
import { StaffAccess } from "@/components/auth/staff-access";

export default function StaffPage() {
  return <Suspense fallback={<main className="min-h-screen bg-cream" />}><StaffAccess /></Suspense>;
}
