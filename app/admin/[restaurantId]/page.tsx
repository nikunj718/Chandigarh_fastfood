import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { redirect } from "next/navigation";
import { requireRestaurantManager } from "@/lib/auth";

export default async function AdminPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  try {
    await requireRestaurantManager(restaurantId);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") redirect("/admin");
    throw error;
  }
  return <AdminDashboard restaurantId={restaurantId} />;
}
