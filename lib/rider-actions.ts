export function riderMapsUrl(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Invalid delivery coordinates.");
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function riderPhoneHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `tel:${phone.trim().startsWith("+") ? "+" : ""}${digits}`;
}
