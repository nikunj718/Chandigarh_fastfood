export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  address_text: string | null;
  latitude: number;
  longitude: number;
  delivery_fee_base: number;
  delivery_fee_per_km: number;
  delivery_radius_km: number;
  active: boolean;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  vegetarian: boolean;
  active: boolean;
};

export type MenuCategory = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  items: MenuItem[];
};

export type Address = {
  id: string;
  label: string;
  address_text: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
};

export type DeliveryQuote = {
  restaurantId: string;
  addressId: string;
  distanceKm: number;
  durationSeconds: number;
  fee: number;
  withinDeliveryRadius: boolean;
};

export type CartLine = {
  itemId: string;
  quantity: number;
};

export type RestaurantCart = {
  restaurantId: string;
  lines: CartLine[];
  updatedAt: string;
};
