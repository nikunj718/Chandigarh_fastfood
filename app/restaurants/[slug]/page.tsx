import { RestaurantStorefront } from "@/components/menu/restaurant-storefront";

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RestaurantStorefront slug={slug} />;
}
