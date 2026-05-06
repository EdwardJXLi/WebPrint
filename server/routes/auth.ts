import rateLimit from 'express-rate-limit';
import express from 'express';

import { env } from '../config/env.js';
import { upsertUser } from '../db/index.js';
import { ensureCsrfToken, issueCsrfToken } from '../middleware/csrf.js';
import { AppError } from '../middleware/error.js';
import {
  buildAuthorizationUrl,
  finishAuthentication,
  normalizeProfile,
  resolveRole,
} from '../services/oidc.js';
import { asyncHandler } from '../utils/async-handler.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again soon.' },
});

const regenerateSession = (req) =>
  new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const destroySession = (req) =>
  new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

router.get(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const authorizationUrl = await buildAuthorizationUrl(req);
    res.redirect(authorizationUrl);
  }),
);

router.get('/me', (req, res) => {
  res.json({
    authenticated: Boolean(req.user),
    user: req.user ? sanitizeUser(req.user) : null,
    config: {
      appName: env.appName,
      appVersion: env.appVersion,
      loginButtonText: env.loginButtonText,
      poweredByFooterEnabled: env.poweredByFooterEnabled,
    },
  });
});

router.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: ensureCsrfToken(req) });
});

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    try {
      await destroySession(req);
    } catch {
      throw new AppError(500, 'Could not end the session.');
    }

    res.clearCookie('cloudprint.sid');
    res.json({ success: true });
  }),
);

const authCallbackHandler = asyncHandler(async (req, res) => {
  const profile = await finishAuthentication(req);
  const role = resolveRole(profile);
  const normalizedProfile = normalizeProfile(profile);
  const user = upsertUser({ ...normalizedProfile, role });

  await regenerateSession(req);
  req.session.userId = user.id;
  issueCsrfToken(req);

  res.redirect(new URL('/', env.appBaseUrl).toString());
});

export { authCallbackHandler };
export default router;
