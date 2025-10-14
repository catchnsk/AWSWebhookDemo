import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminAuthAPI } from '../lib/api';

interface AuthState {
  apiKey: string | null;
  userType: 'producer' | 'subscriber' | 'admin' | null;
  userId: string | null;
  userName: string | null;
  userRole: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb' | null;
  login: (email: string, password: string) => Promise<void>;
  setAuth: (apiKey: string, userType: 'producer' | 'subscriber' | 'admin', userId: string, userName: string, userRole?: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb') => void;
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
      userRole: null,

      login: async (email: string, password: string) => {
        try {
          const result = await adminAuthAPI.login({ email, password });
          set({
            apiKey: result.apiKey,
            userType: 'admin' as const,
            userId: result.user.id,
            userName: result.user.name,
            userRole: result.user.role as 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb'
          });
          localStorage.setItem('apiKey', result.apiKey);
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Invalid credentials');
        }
      },

      setAuth: (apiKey, userType, userId, userName, userRole) => {
        localStorage.setItem('apiKey', apiKey);
        set({ apiKey, userType, userId, userName, userRole });
      },

      clearAuth: () => {
        localStorage.removeItem('apiKey');
        set({ apiKey: null, userType: null, userId: null, userName: null, userRole: null });
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
