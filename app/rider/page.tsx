import { RiderShift } from "@/components/rider/rider-shift";
import { requireRider } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RiderPage() {
  try { await requireRider(); }
  catch (error) { if (error instanceof Error && error.message === "FORBIDDEN") redirect("/restaurants"); throw error; }
  return <RiderShift />;
}
