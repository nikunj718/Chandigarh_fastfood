import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  return <AdminDashboard restaurantId={restaurantId} />;
}
