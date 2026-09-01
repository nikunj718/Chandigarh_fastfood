import { RiderManagement } from "@/components/admin/rider-management";
import { requireRestaurantManager } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RidersPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  try {
    const { membership } = await requireRestaurantManager(restaurantId);
    if (membership.role !== "owner") redirect(`/admin/${restaurantId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/admin");
    throw error;
  }
  return <RiderManagement restaurantId={restaurantId} />;
}
