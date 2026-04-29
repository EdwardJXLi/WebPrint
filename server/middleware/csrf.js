import crypto from 'node:crypto';

import { AppError } from './error.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

const issueCsrfToken = (req) => {
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
};

const ensureCsrfToken = (req) => req.session.csrfToken || issueCsrfToken(req);

const csrfProtection = (req, _res, next) => {
  ensureCsrfToken(req);

  if (safeMethods.has(req.method)) {
    return next();
  }

  const requestToken = req.get('x-csrf-token');
  if (!requestToken || requestToken !== req.session.csrfToken) {
    return next(new AppError(403, 'Invalid CSRF token.'));
  }

  return next();
};

export { csrfProtection, ensureCsrfToken, issueCsrfToken };
