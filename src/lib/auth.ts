import { createContext, useContext } from 'react';
import type { User } from './api';

export type Hub = 'bh' | 'wc' | 'yc' | 'cal';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  selectedHub: Hub;
  isWcReadOnly: boolean;
  isGuest: boolean;
  guestType: 'yc' | 'sac' | null;
  login: (email: string, password: string) => Promise<{ needsHubChoice: boolean }>;
  loginAsGuest: (type: 'yc' | 'sac') => Promise<void>;
  chooseHub: (hub: Hub) => void;
  logout: () => Promise<void>;
  clearResetFlag: () => void;
  markSecurityQuestionsSetup: () => void;
  setEmailNotifications: (enabled: boolean) => void;
}

export const AuthContext = createContext<AuthContextType>(null!);

export function useAuth() {
  return useContext(AuthContext);
}
