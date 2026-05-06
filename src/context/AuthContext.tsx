import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AuthContext } from './auth-context';
import { apiRequest } from '../lib/api';
import type { AppConfig, AuthUser } from '../types';

interface MeResponse {
  authenticated: boolean;
  user: AuthUser | null;
  config: Partial<AppConfig>;
}

const defaultConfig: AppConfig = {
  appName: 'WebPrint',
  appVersion: '',
  loginButtonText: 'Continue',
  poweredByFooterEnabled: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [config, setConfig] = useState(defaultConfig);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest<MeResponse>('/api/auth/me');
      setUser(data.user);
      setConfig({ ...defaultConfig, ...data.config });
    } catch {
      setUser(null);
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = config.appName;
  }, [config.appName]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(() => {
    window.location.assign('/api/auth/login');
  }, []);

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      user,
      config,
      login,
      logout,
      refreshSession,
    }),
    [config, loading, login, logout, refreshSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
