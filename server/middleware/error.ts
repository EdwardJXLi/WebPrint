import fs from 'node:fs/promises';
import type { ErrorRequestHandler, NextFunction, RequestHandler } from 'express';

import { logger } from '../utils/logger.js';

class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const notFound: RequestHandler = (_req, _res, next: NextFunction) => {
  next(new AppError(404, 'Route not found.'));
};

type RequestError = Error & {
  code?: string;
  statusCode?: number;
  details?: unknown;
};

const errorHandler: ErrorRequestHandler = async (error: RequestError, req, res, _next) => {
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
