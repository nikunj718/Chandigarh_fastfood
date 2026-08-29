import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CredentialConfigurationError, decryptCredential, decryptRazorpayCredentials, encryptCredential, hasCompleteRazorpayCredentials, maskRazorpayKeyId } from "@/lib/restaurant-credentials";

const originalEncryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64");
});

afterAll(() => {
  if (originalEncryptionKey === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
  else process.env.CREDENTIAL_ENCRYPTION_KEY = originalEncryptionKey;
});

describe("restaurant Razorpay credential encryption", () => {
  it("round-trips secrets without persisting plaintext", () => {
    const encrypted = encryptCredential("rzp_live_secret_value");
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("rzp_live_secret_value");
    expect(decryptCredential(encrypted)).toBe("rzp_live_secret_value");
  });

  it("rejects a tampered credential ciphertext", () => {
    const encrypted = encryptCredential("tenant-webhook-secret");
    expect(() => decryptCredential(`${encrypted}tampered`)).toThrow(CredentialConfigurationError);
  });

  it("requires all three values before enabling Razorpay", () => {
    expect(hasCompleteRazorpayCredentials({ razorpay_key_id: "rzp_test_1234", razorpay_key_secret: "cipher", razorpay_webhook_secret: null })).toBe(false);
    expect(() => decryptRazorpayCredentials({ razorpay_key_id: null, razorpay_key_secret: null, razorpay_webhook_secret: null })).toThrow("ONLINE_PAYMENT_UNAVAILABLE");
  });

  it("exposes only a masked Key ID hint to owner settings", () => {
    expect(maskRazorpayKeyId("rzp_test_abcdef")).toBe("••••cdef");
    expect(maskRazorpayKeyId(null)).toBeNull();
  });
});
