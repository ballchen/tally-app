import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  session: Session | null;
  initialized: boolean;
  /** Route a signed-out user was heading for (e.g. an invite deep link), replayed after login. */
  pendingRoute: string | null;
  setSession: (session: Session | null) => void;
  setPendingRoute: (route: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  pendingRoute: null,
  setSession: (session) => set({ session, initialized: true }),
  setPendingRoute: (pendingRoute) => set({ pendingRoute }),
}));
