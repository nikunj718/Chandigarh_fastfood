export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export function safeNextPath(value: string | null | undefined, fallback = "/restaurants") {
  return safeReturnPath(value) ?? fallback;
}

export function authCallbackUrl(origin: string, next?: string | null) {
  const returnPath = safeReturnPath(next);
  return `${origin}/auth/callback${returnPath ? `?next=${encodeURIComponent(returnPath)}` : ""}`;
}
