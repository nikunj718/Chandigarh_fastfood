export const FOOD_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const MAX_FOOD_IMAGE_BYTES = 5 * 1024 * 1024;

export function foodImageExtension(type: string) {
  return FOOD_IMAGE_TYPES[type as keyof typeof FOOD_IMAGE_TYPES] ?? null;
}

export function foodImageObjectPath(imageUrl: string | null, restaurantId: string, itemId: string) {
  if (!imageUrl) return null;
  try {
    const pathname = new URL(imageUrl).pathname;
    const publicPrefix = "/storage/v1/object/public/restaurant-food-images/";
    if (!pathname.startsWith(publicPrefix)) return null;
    const objectPath = decodeURIComponent(pathname.slice(publicPrefix.length));
    return objectPath.startsWith(`${restaurantId}/${itemId}/`) ? objectPath : null;
  } catch {
    return null;
  }
}
