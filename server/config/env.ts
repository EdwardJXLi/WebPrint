import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const loadEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const quoted = rawValue.match(/^(["'])(.*)\1$/);
    process.env[key] = quoted ? quoted[2] : rawValue;
  }
};

loadEnvFile();

const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));

const booleanish = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}, z.boolean());

const optionalString = z.preprocess((value) => {
  if (value === undefined || value === null || value === '' || value === 'null') {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const optionalUrl = z.preprocess((value) => {
  if (value === undefined || value === null || value === '' || value === 'null') {
    return undefined;
  }

  return value;
}, z.string().url().optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  APP_NAME: z.string().min(1).max(80).default('WebPrint'),
  LOGIN_BUTTON_TEXT: z.string().min(1).max(80).default('Continue'),
  POWERED_BY_FOOTER_ENABLED: booleanish.default(true),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters.'),
  SESSION_COOKIE_SECURE: booleanish.optional(),
  TRUST_PROXY: booleanish.default(false),
  OIDC_DISCOVERY_URL: z.string().url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: optionalString,
  OIDC_REDIRECT_URI: optionalUrl,
  OIDC_SCOPE: z.string().default('openid profile email'),
  OIDC_ROLE_CLAIM: z.string().optional(),
  OIDC_ADMIN_ROLE_VALUE: z.string().default('admin'),
  ADMIN_EMAILS: z.string().optional(),
  CUPS_IPP_URL: optionalUrl,
  SQLITE_PATH: z.string().default('./storage/cloudprint.sqlite'),
  UPLOAD_DIR: z.string().default('./storage/uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(100).default(25),
});

const parsed = schema.parse(process.env);

const resolvePath = (value) => (path.isAbsolute(value) ? value : path.resolve(process.cwd(), value));

const adminEmails = new Set(
  (parsed.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  appBaseUrl: parsed.APP_BASE_URL,
  appName: parsed.APP_NAME,
  appVersion: packageJson.version || '0.0.0',
  loginButtonText: parsed.LOGIN_BUTTON_TEXT,
  poweredByFooterEnabled: parsed.POWERED_BY_FOOTER_ENABLED,
  sessionSecret: parsed.SESSION_SECRET,
  sessionCookieSecure:
    parsed.SESSION_COOKIE_SECURE ?? parsed.NODE_ENV === 'production',
  trustProxy: parsed.TRUST_PROXY,
  oidcDiscoveryUrl: parsed.OIDC_DISCOVERY_URL,
  oidcClientId: parsed.OIDC_CLIENT_ID,
  oidcClientSecret: parsed.OIDC_CLIENT_SECRET || null,
  oidcRedirectUri: parsed.OIDC_REDIRECT_URI || `${parsed.APP_BASE_URL}/auth/callback`,
  oidcScope: parsed.OIDC_SCOPE,
  oidcRoleClaim: parsed.OIDC_ROLE_CLAIM,
  oidcAdminRoleValue: parsed.OIDC_ADMIN_ROLE_VALUE,
  adminEmails,
  cupsIppUrl: parsed.CUPS_IPP_URL || null,
  sqlitePath: resolvePath(parsed.SQLITE_PATH),
  uploadDir: resolvePath(parsed.UPLOAD_DIR),
  maxUploadBytes: parsed.MAX_UPLOAD_MB * 1024 * 1024,
};

const ensureRuntimeDirectories = () => {
  fs.mkdirSync(path.dirname(env.sqlitePath), { recursive: true });
  fs.mkdirSync(env.uploadDir, { recursive: true });
};

export { env, ensureRuntimeDirectories };
