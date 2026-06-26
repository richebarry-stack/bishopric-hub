import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type User } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearResetFlag: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth.me().then(({ user }) => {
      setUser(user);
      setLoading(false);
      if (user) api.syncConduct().catch(() => {});
    }).catch(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { user } = await api.auth.login(email, password);
    setUser(user);
    api.syncConduct().catch(() => {});
  };

  const logout = async () => {
    await api.auth.logout();
    setUser(null);
  };

  const clearResetFlag = () => {
    if (user) setUser({ ...user, must_reset_password: false });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clearResetFlag }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
