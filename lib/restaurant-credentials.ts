import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const CIPHER_VERSION = "v1";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export class CredentialConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialConfigurationError";
  }
}

export type RazorpayCredentials = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

type StoredCredentials = {
  razorpay_key_id: string | null;
  razorpay_key_secret: string | null;
  razorpay_webhook_secret: string | null;
};

function encryptionKey() {
  const encodedKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encodedKey) throw new CredentialConfigurationError("Credential encryption is not configured.");
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new CredentialConfigurationError("CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptCredential(value: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [CIPHER_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptCredential(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(":");
  if (version !== CIPHER_VERSION || !encodedIv || !encodedTag || !encodedCiphertext || extra.length) {
    throw new CredentialConfigurationError("Stored restaurant credentials are invalid.");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES || !ciphertext.length) {
    throw new CredentialConfigurationError("Stored restaurant credentials are invalid.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new CredentialConfigurationError("Stored restaurant credentials could not be decrypted.");
  }
}

export function hasCompleteRazorpayCredentials(credentials: StoredCredentials) {
  return Boolean(credentials.razorpay_key_id && credentials.razorpay_key_secret && credentials.razorpay_webhook_secret);
}

export function decryptRazorpayCredentials(credentials: StoredCredentials): RazorpayCredentials {
  if (!hasCompleteRazorpayCredentials(credentials)) throw new CredentialConfigurationError("ONLINE_PAYMENT_UNAVAILABLE");
  return {
    keyId: credentials.razorpay_key_id!,
    keySecret: decryptCredential(credentials.razorpay_key_secret!),
    webhookSecret: decryptCredential(credentials.razorpay_webhook_secret!),
  };
}

export function maskRazorpayKeyId(keyId: string | null) {
  if (!keyId) return null;
  return keyId.length <= 4 ? "••••" : `••••${keyId.slice(-4)}`;
}
