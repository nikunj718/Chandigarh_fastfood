const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl: publicUrl,
  supabaseAnonKey: publicKey,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY,
  customerContactEncryptionKey: process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY,
};

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function assertServerEnv(...keys: Array<keyof typeof env>) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw new Error(`Missing server configuration: ${missing.join(", ")}`);
}
