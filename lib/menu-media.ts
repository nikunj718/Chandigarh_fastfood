export const FOOD_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export const MAX_FOOD_IMAGE_BYTES = 5 * 1024 * 1024;

export function foodImageExtension(type: string) {
  return FOOD_IMAGE_TYPES[type as keyof typeof FOOD_IMAGE_TYPES] ?? null;
}
