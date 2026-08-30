import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CustomerContactError, decryptCustomerContact, encryptCustomerContact, lastFourDigits } from "@/lib/customer-contact";

const originalEncryptionKey = process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY = Buffer.alloc(32, 29).toString("base64");
});

afterAll(() => {
  if (originalEncryptionKey === undefined) delete process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY;
  else process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY = originalEncryptionKey;
});

describe("guest delivery contact encryption", () => {
  it("round-trips a normalized contact without exposing it in ciphertext", () => {
    const encrypted = encryptCustomerContact("+919876543210");
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("9876543210");
    expect(decryptCustomerContact(encrypted)).toBe("+919876543210");
  });

  it("rejects altered encrypted contacts", () => {
    expect(() => decryptCustomerContact(`${encryptCustomerContact("+919876543210")}altered`)).toThrow(CustomerContactError);
  });

  it("retains only the order-safe last four digit display value", () => {
    expect(lastFourDigits("+91 98765 43210")).toBe("3210");
  });
});
