import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from '@/lib/safeStorage';

export interface GuestCartLine {
  offerId: number;
  quantity: number;
}

interface GuestCartState {
  lines: GuestCartLine[];
  add: (offerId: number, quantity?: number) => void;
  clear: () => void;
}

/** Cart for signed-out visitors; merged into the server cart on login (POST /cart/merge, M6). */
export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (offerId, quantity = 1) =>
        set(({ lines }) => {
          const existing = lines.find((l) => l.offerId === offerId);
          return {
            lines: existing
              ? lines.map((l) => (l.offerId === offerId ? { ...l, quantity: l.quantity + quantity } : l))
              : [...lines, { offerId, quantity }],
          };
        }),
      clear: () => set({ lines: [] }),
    }),
    { name: 'guest-cart', storage: persistStorage },
  ),
);

export const selectGuestCartCount = (s: GuestCartState) => s.lines.reduce((n, l) => n + l.quantity, 0);
