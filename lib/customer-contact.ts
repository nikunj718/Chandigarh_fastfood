import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export class CustomerContactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerContactError";
  }
}

function encryptionKey() {
  const encodedKey = process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY;
  if (!encodedKey) throw new CustomerContactError("Customer contact encryption is not configured.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new CustomerContactError("CUSTOMER_CONTACT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptCustomerContact(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [CIPHER_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptCustomerContact(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(":");
  if (version !== CIPHER_VERSION || !encodedIv || !encodedTag || !encodedCiphertext || extra.length) {
    throw new CustomerContactError("Stored customer contact is invalid.");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || !ciphertext.length) {
    throw new CustomerContactError("Stored customer contact is invalid.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new CustomerContactError("Stored customer contact could not be decrypted.");
  }
}

export function lastFourDigits(phone: string) {
  return phone.replace(/\D/g, "").slice(-4);
}
