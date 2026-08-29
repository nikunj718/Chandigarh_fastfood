"use client";

import dynamic from "next/dynamic";

const TrackingExperience = dynamic(() => import("@/components/tracking/tracking-experience").then((module) => module.TrackingExperience), {
  ssr: false,
  loading: () => <main className="grid min-h-screen place-items-center bg-cream text-stone-600">Loading delivery tracking…</main>,
});

export function TrackingPageClient({ orderId }: { orderId: string }) {
  return <TrackingExperience orderId={orderId} />;
}
