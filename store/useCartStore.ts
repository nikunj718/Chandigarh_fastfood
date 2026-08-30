"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine, RestaurantCart } from "@/lib/types";

type CartState = {
  cartsByRestaurant: Record<string, RestaurantCart>;
  activeRestaurantId: string | null;
  open: boolean;
  selectRestaurant: (restaurantId: string) => void;
  addItem: (restaurantId: string, itemId: string) => void;
  setQuantity: (restaurantId: string, itemId: string, quantity: number) => void;
  clearCart: (restaurantId: string) => void;
  clearAllCarts: () => void;
  setOpen: (open: boolean) => void;
};

export function updateCartLine(lines: CartLine[], itemId: string, quantity: number) {
  const exists = lines.some((line) => line.itemId === itemId);
  if (quantity <= 0) return lines.filter((line) => line.itemId !== itemId);
  if (!exists) return [...lines, { itemId, quantity }];
  return lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line));
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cartsByRestaurant: {},
      activeRestaurantId: null,
      open: false,
      selectRestaurant: (restaurantId) => set({ activeRestaurantId: restaurantId }),
      addItem: (restaurantId, itemId) =>
        set((state) => {
          const cart = state.cartsByRestaurant[restaurantId] ?? { restaurantId, lines: [], updatedAt: new Date().toISOString() };
          const currentQuantity = cart.lines.find((line) => line.itemId === itemId)?.quantity ?? 0;
          return {
            activeRestaurantId: restaurantId,
            cartsByRestaurant: {
              ...state.cartsByRestaurant,
              [restaurantId]: { ...cart, lines: updateCartLine(cart.lines, itemId, currentQuantity + 1), updatedAt: new Date().toISOString() },
            },
          };
        }),
      setQuantity: (restaurantId, itemId, quantity) =>
        set((state) => {
          const cart = state.cartsByRestaurant[restaurantId] ?? { restaurantId, lines: [], updatedAt: new Date().toISOString() };
          return {
            cartsByRestaurant: {
              ...state.cartsByRestaurant,
              [restaurantId]: { ...cart, lines: updateCartLine(cart.lines, itemId, quantity), updatedAt: new Date().toISOString() },
            },
          };
        }),
      clearCart: (restaurantId) =>
        set((state) => ({
          cartsByRestaurant: { ...state.cartsByRestaurant, [restaurantId]: { restaurantId, lines: [], updatedAt: new Date().toISOString() } },
        })),
      clearAllCarts: () => set({ cartsByRestaurant: {}, activeRestaurantId: null, open: false }),
      setOpen: (open) => set({ open }),
    }),
    { name: "chandigarh-fastfood-carts", version: 1 },
  ),
);
