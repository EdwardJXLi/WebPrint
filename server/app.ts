import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';

import { env } from './config/env.js';
import db from './db/index.js';
import { SQLiteSessionStore } from './db/session-store.js';
import { attachUser } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRouter, { authCallbackHandler } from './routes/auth.js';
import printersRouter from './routes/printers.js';
import jobsRouter from './routes/jobs.js';
import dashboardRouter from './routes/dashboard.js';
import { requestLogger } from './utils/logger.js';

const projectRoot = process.cwd();
const clientDistDir = path.resolve(projectRoot, 'dist/client');
const clientHtmlPath = path.resolve(projectRoot, 'index.html');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const shouldBypassSpa = (requestPath: string) =>
  requestPath.startsWith('/api/') || requestPath === '/auth/callback' || requestPath === '/health';

const createApp = async () => {
  const app = express();
  const sessionStore = new SQLiteSessionStore(db);

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy ? 1 : 0);

  app.use(
    helmet({
      contentSecurityPolicy:
        env.nodeEnv === 'development'
          ? false
          : {
              directives: {
                defaultSrc: ["'self'"],
                connectSrc: ["'self'"],
                imgSrc: ["'self'", 'data:'],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
              },
            },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(apiLimiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(
    session({
      name: 'cloudprint.sid',
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.sessionCookieSecure,
        maxAge: 1000 * 60 * 60 * 8,
      },
    }),
  );
  app.use(attachUser);
  app.use(requestLogger);
  app.use(csrfProtection);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.get('/auth/callback', authCallbackHandler);
  app.use('/api/printers', printersRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/dashboard', dashboardRouter);

  if (env.nodeEnv === 'development') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      configFile: path.resolve(projectRoot, 'vite.config.ts'),
      server: {
        middlewareMode: true,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (shouldBypassSpa(req.path)) {
        return next();
      }

      try {
        const template = await fsPromises.readFile(clientHtmlPath, 'utf8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        return res.status(200).contentType('text/html').send(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        return next(error);
      }
    });
  } else if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (shouldBypassSpa(req.path)) {
        return next();
      }

      return res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

export { createApp };
