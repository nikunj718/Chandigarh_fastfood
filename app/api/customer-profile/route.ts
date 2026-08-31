import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/auth";
import { CustomerContactError, decryptOptionalCustomerContact, encryptCustomerContact } from "@/lib/customer-contact";
import { hasRestaurantOwnerAccess } from "@/lib/session-routing";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeIndianPhone } from "@/lib/utils";

const contactSchema = z.object({ deliveryPhone: z.string().trim().min(1).max(30) });

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const [profileResult, ownerMembershipResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("email,display_name,default_delivery_phone_ciphertext")
        .eq("id", user.id)
        .single(),
      supabase
        .from("restaurant_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .limit(1),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (ownerMembershipResult.error) throw ownerMembershipResult.error;
    const data = profileResult.data;
    const deliveryContact = decryptOptionalCustomerContact(data?.default_delivery_phone_ciphertext ?? null);
    return NextResponse.json({
      email: data?.email ?? user.email,
      displayName: data?.display_name ?? null,
      defaultDeliveryPhone: deliveryContact.value,
      deliveryContactUnavailable: deliveryContact.unavailable,
      isRestaurantOwner: hasRestaurantOwnerAccess(ownerMembershipResult.data ?? []),
    });
  } catch (error) {
    return apiError(error, "Customer profile could not be loaded.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = contactSchema.parse(await request.json());
    const phone = normalizeIndianPhone(input.deliveryPhone);
    if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit Indian delivery number." }, { status: 400 });
    const { user } = await requireUser();
    const { error } = await getSupabaseAdminClient()
      .from("profiles")
      .update({ default_delivery_phone_ciphertext: encryptCustomerContact(phone) })
      .eq("id", user.id);
    if (error) throw error;
    return NextResponse.json({ deliveryPhone: phone });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Enter a valid delivery phone number." }, { status: 400 });
    if (error instanceof CustomerContactError) return NextResponse.json({ error: "Delivery contact saving is not configured." }, { status: 503 });
    return apiError(error, "Delivery contact could not be saved.");
  }
}
