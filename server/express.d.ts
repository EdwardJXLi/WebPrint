import type { UserRow } from './types.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserRow;
      savedUploadPath?: string;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    csrfToken?: string;
    oidcTransaction?: {
      state: string;
      nonce: string;
      codeVerifier: string;
    };
  }
}

export {};
