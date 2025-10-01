import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  apiKey: string | null;
  userType: 'producer' | 'subscriber' | 'admin' | null;
  userId: string | null;
  userName: string | null;
  setAuth: (apiKey: string, userType: 'producer' | 'subscriber' | 'admin', userId: string, userName: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      userType: null,
      userId: null,
      userName: null,

      setAuth: (apiKey, userType, userId, userName) => {
        localStorage.setItem('apiKey', apiKey);
        set({ apiKey, userType, userId, userName });
      },

      clearAuth: () => {
        localStorage.removeItem('apiKey');
        set({ apiKey: null, userType: null, userId: null, userName: null });
      },

      isAuthenticated: () => {
        return get().apiKey !== null;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
