import { TrackingPageClient } from "@/components/tracking/tracking-page-client";

export default async function TrackingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <TrackingPageClient orderId={orderId} />;
}
