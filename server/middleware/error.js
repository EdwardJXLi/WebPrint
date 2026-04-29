import fs from 'node:fs/promises';

import { logger } from '../utils/logger.js';

class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const notFound = (_req, _res, next) => {
  next(new AppError(404, 'Route not found.'));
};

const errorHandler = async (error, req, res, _next) => {
  const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 400 : error.statusCode || 500;
  const publicMessage =
    error.code === 'LIMIT_FILE_SIZE'
      ? 'The uploaded file exceeds the configured upload size limit.'
      : statusCode === 500
        ? 'An unexpected server error occurred.'
        : error.message;

  if (req.savedUploadPath && statusCode >= 400) {
    try {
      await fs.unlink(req.savedUploadPath);
    } catch {
      // Ignore cleanup errors.
    }
  }

  logger.error('Request failed', {
    method: req.method,
    path: req.path,
    statusCode,
    message: error.message,
  });

  res.status(statusCode).json({
    error: publicMessage,
    ...(error.details ? { details: error.details } : {}),
  });
};

export { AppError, errorHandler, notFound };
