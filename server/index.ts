import { createApp } from './app.js';
import { env, ensureRuntimeDirectories } from './config/env.js';
import { logger } from './utils/logger.js';

ensureRuntimeDirectories();

const app = await createApp();

app.listen(env.port, () => {
  logger.info(`${env.appName} started`, {
    port: env.port,
    environment: env.nodeEnv,
  });
});
