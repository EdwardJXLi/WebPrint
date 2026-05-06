import { createContext } from 'react';

import type { AppConfig, AuthUser } from '../types';

export interface AuthContextValue {
  loading: boolean;
  user: AuthUser | null;
  config: AppConfig;
  login: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
