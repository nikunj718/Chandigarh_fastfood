import { Suspense } from "react";
import { RestaurantDirectory } from "@/components/restaurants/restaurant-directory";

export default function RestaurantsPage() { return <Suspense fallback={<main className="min-h-screen bg-cream" />}><RestaurantDirectory /></Suspense>; }
