import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api/endpoints';
import { apiClient } from '../api/client';
import type { User } from '../api/types';

type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  signup(email: string, password: string): Promise<void>;
  logout(allSessions?: boolean): Promise<void>;
  refreshUser(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();

  const becomeAnonymous = useCallback(() => {
    apiClient.setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => apiClient.onSessionExpired(becomeAnonymous), [becomeAnonymous]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const restored = await apiClient.restoreSession();
      if (!active) return;
      if (!restored) {
        becomeAnonymous();
        return;
      }
      try {
        const response = await authApi.currentUser();
        if (active) {
          setUser(response.user);
          setStatus('authenticated');
        }
      } catch {
        if (active) becomeAnonymous();
      }
    })();
    return () => {
      active = false;
    };
  }, [becomeAnonymous]);

  const establish = useCallback(
    async (operation: Promise<{ user: User; session: { token: string } }>) => {
      const response = await operation;
      apiClient.setAccessToken(response.session.token);
      setUser(response.user);
      setStatus('authenticated');
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: (email, password) => establish(authApi.login(email, password)),
      signup: (email, password) => establish(authApi.signup(email, password)),
      logout: async (allSessions = false) => {
        try {
          await authApi.logout(allSessions);
        } finally {
          becomeAnonymous();
        }
      },
      refreshUser: async () => {
        const response = await authApi.currentUser();
        setUser(response.user);
      },
    }),
    [becomeAnonymous, establish, status, user],
  );

  useEffect(() => {
    if (status !== 'anonymous') return;
    const reason = sessionStorage.getItem('watchtrace-session-message');
    if (reason) {
      sessionStorage.removeItem('watchtrace-session-message');
      notifications.show({ color: 'orange', title: 'Session ended', message: reason });
    }
  }, [status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
