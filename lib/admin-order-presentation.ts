import { decryptCustomerContact } from "@/lib/customer-contact";

export function safeOrderForAdmin(order: Record<string, unknown>) {
  const { delivery_phone_ciphertext, ...safeOrder } = order;
  let deliveryPhone: string | null = null;
  if (typeof delivery_phone_ciphertext === "string") {
    try {
      deliveryPhone = decryptCustomerContact(delivery_phone_ciphertext);
    } catch (error) {
      console.warn("Order delivery contact could not be decrypted", { error });
    }
  }
  return { ...safeOrder, deliveryPhone };
}
