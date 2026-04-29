import { getUserById } from '../db/index.js';
import { AppError } from './error.js';

const attachUser = (req, _res, next) => {
  if (!req.session?.userId) {
    return next();
  }

  try {
    const user = getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return next();
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireAuth = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required.'));
  }

  return next();
};

const requireAdmin = (req, _res, next) => {
  if (!req.user) {
    return next(new AppError(401, 'Authentication required.'));
  }

  if (req.user.role !== 'admin') {
    return next(new AppError(403, 'Admin access required.'));
  }

  return next();
};

export { attachUser, requireAuth, requireAdmin };
