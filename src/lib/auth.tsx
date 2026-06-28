import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type User } from './api';

type Hub = 'bh' | 'wc' | 'yc' | 'cal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  selectedHub: Hub;
  isWcReadOnly: boolean;
  login: (email: string, password: string) => Promise<{ needsHubChoice: boolean }>;
  chooseHub: (hub: Hub) => void;
  logout: () => Promise<void>;
  clearResetFlag: () => void;
  markSecurityQuestionsSetup: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

function resolveHub(user: User, stored: Hub | null): Hub {
  if (user.hub === 'yc') return 'yc';
  if (user.hub === 'cal') return 'cal';
  if (user.hub === 'wc') return stored === 'yc' ? 'yc' : 'wc';
  return stored ?? 'bh';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHubState] = useState<Hub>('bh');

  useEffect(() => {
    api.auth.me().then(({ user }) => {
      if (user) {
        const stored = localStorage.getItem('selected_hub') as Hub | null;
        setSelectedHubState(resolveHub(user, stored));
        api.syncConduct().catch(() => {});
      }
      setUser(user);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const chooseHub = (hub: Hub) => {
    localStorage.setItem('selected_hub', hub);
    setSelectedHubState(hub);
  };

  const login = async (email: string, password: string): Promise<{ needsHubChoice: boolean }> => {
    const { user } = await api.auth.login(email, password);
    setUser(user);
    api.syncConduct().catch(() => {});
    if (user.hub === 'both') {
      const stored = localStorage.getItem('selected_hub') as Hub | null;
      if (!stored) return { needsHubChoice: true };
      setSelectedHubState(stored);
      return { needsHubChoice: false };
    }
    setSelectedHubState(resolveHub(user, null));
    return { needsHubChoice: false };
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const clearResetFlag = () => {
    if (user) setUser({ ...user, must_reset_password: false });
  };

  const markSecurityQuestionsSetup = () => {
    if (user) setUser({ ...user, has_security_questions: true });
  };

  const isWcReadOnly = user?.hub === 'wc';

  return (
    <AuthContext.Provider value={{ user, loading, selectedHub, isWcReadOnly, login, chooseHub, logout, clearResetFlag, markSecurityQuestionsSetup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
