import { Issuer, generators } from 'openid-client';

import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';

let clientPromise;

const getClient = async () => {
  if (!clientPromise) {
    clientPromise = Issuer.discover(env.oidcDiscoveryUrl).then((issuer) => {
      const clientConfig: Record<string, unknown> = {
        client_id: env.oidcClientId,
        redirect_uris: [env.oidcRedirectUri],
        response_types: ['code'],
      };

      if (env.oidcClientSecret) {
        clientConfig.client_secret = env.oidcClientSecret;
      } else {
        clientConfig.token_endpoint_auth_method = 'none';
      }

      return new issuer.Client(clientConfig as any);
    });
  }

  return clientPromise;
};

const buildAuthorizationUrl = async (req) => {
  const client = await getClient();
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  req.session.oidcTransaction = {
    state,
    nonce,
    codeVerifier,
  };

  return client.authorizationUrl({
    scope: env.oidcScope,
    response_type: 'code',
    redirect_uri: env.oidcRedirectUri,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
};

const finishAuthentication = async (req) => {
  const client = await getClient();
  const transaction = req.session.oidcTransaction;

  if (!transaction) {
    throw new AppError(400, 'OIDC session state was not found. Please try logging in again.');
  }

  const params = client.callbackParams(req);
  const tokenSet = await client.callback(env.oidcRedirectUri, params, {
    state: transaction.state,
    nonce: transaction.nonce,
    code_verifier: transaction.codeVerifier,
  });

  const claims = tokenSet.claims();
  let userInfo = {};

  if (tokenSet.access_token) {
    try {
      userInfo = await client.userinfo(tokenSet.access_token);
    } catch {
      userInfo = {};
    }
  }

  delete req.session.oidcTransaction;
  return { ...claims, ...userInfo };
};

const getNestedValue = (source, path) => {
  if (!path) {
    return undefined;
  }

  return path.split('.').reduce((current, key) => current?.[key], source);
};

const hasRoleValue = (roleClaim, roleValue) => {
  if (!roleClaim || !roleValue) {
    return false;
  }

  if (Array.isArray(roleClaim)) {
    return roleClaim.includes(roleValue);
  }

  if (typeof roleClaim === 'string') {
    return roleClaim === roleValue;
  }

  if (typeof roleClaim === 'object') {
    return Object.prototype.hasOwnProperty.call(roleClaim, roleValue);
  }

  return false;
};

const resolveRole = (profile) => {
  const roleClaim = getNestedValue(profile, env.oidcRoleClaim);
  if (hasRoleValue(roleClaim, env.oidcAdminRoleValue)) {
    return 'admin';
  }

  const email = String(profile.email || '').toLowerCase();
  if (email && env.adminEmails.has(email)) {
    return 'admin';
  }

  return 'user';
};

const normalizeProfile = (profile) => ({
  subject: profile.sub,
  email: profile.email || null,
  name:
    profile.name ||
    profile.preferred_username ||
    profile.email ||
    `User ${String(profile.sub || '').slice(0, 8)}`,
  picture: profile.picture || null,
});

export { buildAuthorizationUrl, finishAuthentication, normalizeProfile, resolveRole };
