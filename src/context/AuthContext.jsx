import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../lib/api.js';

const AuthContext = createContext(null);

const defaultConfig = {
  appName: 'WebPrint',
  loginButtonText: 'Continue',
};

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(defaultConfig);

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/me');
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
