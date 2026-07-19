import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiRequest } from '../api/client';
import {
  clearToken,
  getToken,
  hasPersistentToken,
  storeToken,
} from '../api/tokenStorage';
import { AuthResponse, AuthUser } from '../api/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const REFRESH_INTERVAL = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    apiRequest<AuthUser>('/auth/me')
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await apiRequest<AuthResponse>('/auth/refresh', {
          method: 'POST',
        });
        storeToken(response.accessToken, hasPersistentToken());
        setUser(response.user);
      } catch {
        logout();
      }
    };
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL);
    return () => window.clearInterval(interval);
  }, [logout, user]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      storeToken(response.accessToken, remember);
      setUser(response.user);
    },
    [],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [loading, login, logout, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
