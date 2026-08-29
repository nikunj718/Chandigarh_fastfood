import { NextRequest, NextResponse } from "next/server";
import { apiError, requireUser } from "@/lib/auth";
import { createDeliveryQuote, quoteRequestSchema } from "@/lib/delivery";

export async function POST(request: NextRequest) {
  try {
    const input = quoteRequestSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    const quote = await createDeliveryQuote(supabase, user.id, input);
    if (!quote.withinDeliveryRadius) return NextResponse.json({ ...quote, error: "This address is outside the restaurant's delivery radius." }, { status: 422 });
    return NextResponse.json(quote);
  } catch (error) {
    return apiError(error, "A delivery quote could not be calculated.");
  }
}
