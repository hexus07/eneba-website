import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Short-lived notifications ("Added to cart", "Only 2 left in stock"). Rendered by <Toaster />. */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, tone = 'success') => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string, tone?: Toast['tone']) => useToastStore.getState().show(message, tone);
