import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireRestaurantManager } from "@/lib/auth";
import { safeOrderForAdmin } from "@/lib/admin-order-presentation";
import { indiaDayBounds, todayInIndia } from "@/lib/order-workflow";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const orderColumns = "id,order_number,status,payment_method,payment_status,total,created_at,preparation_minutes,confirmed_at,preparing_at,prepared_at,out_for_delivery_at,delivered_at,cancelled_at,delivery_phone_ciphertext,delivery_phone_last4,delivery_assignments(rider_id)";

export async function GET(request: NextRequest, context: { params: Promise<{ restaurantId: string }> }) {
  try {
    const { restaurantId } = await context.params;
    const parsed = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const date = parsed.date ?? todayInIndia();
    if (date > todayInIndia()) return NextResponse.json({ error: "Choose today or an earlier date." }, { status: 400 });
    const { start, end } = indiaDayBounds(date);
    await requireRestaurantManager(restaurantId);
    const admin = getSupabaseAdminClient();
    let orderQuery = admin
      .from("orders")
      .select(orderColumns)
      .eq("restaurant_id", restaurantId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("order_number", { ascending: false });
    if (parsed.cursor) orderQuery = orderQuery.lt("order_number", parsed.cursor);
    const [{ data: requestedOrders, error: ordersError }, { data: summaryRows, error: summaryError }] = await Promise.all([
      orderQuery.limit(parsed.limit + 1),
      admin.rpc("restaurant_order_daily_summary", { p_restaurant_id: restaurantId, p_day_start: start, p_day_end: end }),
    ]);
    if (ordersError) throw ordersError;
    if (summaryError) throw summaryError;
    const hasMore = (requestedOrders?.length ?? 0) > parsed.limit;
    const page = (requestedOrders ?? []).slice(0, parsed.limit);
    const summary = summaryRows?.[0] ?? { accepted_order_count: 0, accepted_gross_value: 0 };
    return NextResponse.json({
      date,
      orders: page.map((order) => safeOrderForAdmin(order as Record<string, unknown>)),
      nextCursor: hasMore ? page.at(-1)?.order_number ?? null : null,
      summary: {
        acceptedOrderCount: Number(summary.accepted_order_count),
        acceptedGrossValue: Number(summary.accepted_gross_value),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message === "INVALID_ORDER_DATE")) {
      return NextResponse.json({ error: "Choose a valid date and page size." }, { status: 400 });
    }
    return apiError(error, "Orders could not be loaded.");
  }
}
