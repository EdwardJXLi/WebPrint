const sensitiveKeys = new Set([
  'authorization',
  'cookie',
  'access_token',
  'refresh_token',
  'id_token',
  'client_secret',
  'session_secret',
]);

const redact = (value) => {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKeys.has(key.toLowerCase()) ? '[REDACTED]' : redact(nestedValue),
      ]),
    );
  }

  return value;
};

const emit = (level, message, meta = {}) => {
  const line = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    message,
    ...redact(meta),
  });

  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
};

const logger = {
  info(message, meta) {
    emit('info', message, meta);
  },
  error(message, meta) {
    emit('error', message, meta);
  },
};

const requestLogger = (req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.user?.id || null,
    });
  });

  next();
};

export { logger, requestLogger };
