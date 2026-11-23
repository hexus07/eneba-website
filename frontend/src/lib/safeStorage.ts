import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * localStorage that never throws: private windows, blocked site data or quota errors make the
 * accessor itself throw. Persisted stores then simply start empty instead of crashing the app.
 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const persistStorage = createJSONStorage(() => safeLocalStorage);
