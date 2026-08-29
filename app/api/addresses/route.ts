import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";

const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default("Home"),
  addressText: z.string().trim().min(5).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDefault: z.boolean().default(true),
});

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("customer_addresses").select("id,label,address_text,latitude,longitude,is_default").eq("customer_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json((data ?? []).map((row) => ({ ...row, latitude: Number(row.latitude), longitude: Number(row.longitude) })));
  } catch (error) { return apiError(error, "Addresses could not be loaded."); }
}

export async function POST(request: NextRequest) {
  try {
    const body = addressSchema.parse(await request.json());
    const { supabase, user } = await requireUser();
    if (body.isDefault) {
      const { error } = await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", user.id).eq("is_default", true);
      if (error) throw error;
    }
    const { data, error } = await supabase.from("customer_addresses").insert({ customer_id: user.id, label: body.label, address_text: body.addressText, latitude: body.latitude, longitude: body.longitude, is_default: body.isDefault }).select("id,label,address_text,latitude,longitude,is_default").single();
    if (error) throw error;
    return NextResponse.json({ ...data, latitude: Number(data.latitude), longitude: Number(data.longitude) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the address fields and try again." }, { status: 400 });
    return apiError(error, "The address could not be saved.");
  }
}
