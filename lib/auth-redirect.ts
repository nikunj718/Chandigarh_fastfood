export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export function cleanReturnPath(value: string | null | undefined) {
  let current = safeReturnPath(value);
  const seen = new Set<string>();

  while (current) {
    if (seen.has(current)) return null;
    seen.add(current);
    const url = new URL(current, "https://fastfood.local");
    if (!url.searchParams.has("next")) return current;
    const nested = safeReturnPath(url.searchParams.get("next"));
    if (!nested) return null;
    current = nested;
  }

  return null;
}

export function returnPathFromRequest(pathname: string, search: string) {
  const searchParams = new URLSearchParams(search);
  return searchParams.has("next") ? cleanReturnPath(searchParams.get("next")) : cleanReturnPath(pathname);
}

export function safeNextPath(value: string | null | undefined, fallback = "/restaurants") {
  return cleanReturnPath(value) ?? fallback;
}

export function authCallbackUrl(origin: string, next?: string | null) {
  const returnPath = cleanReturnPath(next);
  return `${origin}/auth/callback${returnPath ? `?next=${encodeURIComponent(returnPath)}` : ""}`;
}

export function signInUrl(next?: string | null) {
  const returnPath = cleanReturnPath(next);
  return returnPath ? `/?next=${encodeURIComponent(returnPath)}` : "/";
}
