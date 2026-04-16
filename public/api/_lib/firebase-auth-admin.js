import { createSign } from 'node:crypto';

const DEFAULT_FIREBASE_PROJECT_ID = 'big-sister-foundation';
const DEFAULT_FIREBASE_WEB_API_KEY = 'AIzaSyCwos6XR9-uqAf_Esmh2K_hJoLxq4gnEuU';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/cloud-platform'
].join(' ');

let accessTokenCache = {
  token: '',
  expiresAt: 0,
  serviceAccountEmail: ''
};

function serviceError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details || {};
  return error;
}

function getProjectId() {
  return String(process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID).trim();
}

function getWebApiKey() {
  return String(process.env.FIREBASE_WEB_API_KEY || DEFAULT_FIREBASE_WEB_API_KEY).trim();
}

function decodeEnvMultiline(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

function parseServiceAccountJson() {
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (_parseError) {
      throw serviceError(500, 'invalid_service_account', 'Firebase service account JSON is invalid');
    }
    return {
      projectId: String(parsed.project_id || '').trim(),
      clientEmail: String(parsed.client_email || '').trim(),
      privateKey: decodeEnvMultiline(parsed.private_key || '')
    };
  }

  const projectId = String(process.env.FIREBASE_ADMIN_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '').trim();
  const privateKey = decodeEnvMultiline(process.env.FIREBASE_ADMIN_PRIVATE_KEY || '');
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  throw serviceError(500, 'missing_service_account', 'Firebase Admin service account is not configured');
}

function getServiceAccount() {
  const serviceAccount = parseServiceAccountJson();
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    throw serviceError(500, 'invalid_service_account', 'Firebase Admin service account is incomplete');
  }
  return serviceAccount;
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createSignedJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const payload = {
    iss: serviceAccount.clientEmail,
    sub: serviceAccount.clientEmail,
    scope: OAUTH_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const unsignedToken = encodedHeader + '.' + encodedPayload;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(serviceAccount.privateKey);
  return unsignedToken + '.' + signature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function exchangeServiceAccountToken(serviceAccount) {
  if (
    accessTokenCache.token &&
    accessTokenCache.serviceAccountEmail === serviceAccount.clientEmail &&
    accessTokenCache.expiresAt > Date.now() + 60 * 1000
  ) {
    return accessTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: createSignedJwt(serviceAccount)
  });
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const payloadText = await response.text();
  let payload = {};
  try {
    payload = payloadText ? JSON.parse(payloadText) : {};
  } catch (_parseError) {
    payload = {};
  }

  if (!response.ok || !payload.access_token) {
    throw serviceError(500, 'service_account_token_failed', 'Unable to mint a Firebase Admin access token', {
      status: response.status,
      error: payload.error || payload.error_description || payloadText
    });
  }

  accessTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(300, Number(payload.expires_in || 3600) - 60) * 1000,
    serviceAccountEmail: serviceAccount.clientEmail
  };
  return accessTokenCache.token;
}

async function identityToolkitRequest(path, body, options) {
  const opts = options || {};
  const serviceAccount = getServiceAccount();
  const accessToken = await exchangeServiceAccountToken(serviceAccount);
  const url = new URL('https://identitytoolkit.googleapis.com' + path);
  if (opts.includeApiKey !== false) {
    url.searchParams.set('key', getWebApiKey());
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + accessToken,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body || {})
  });

  const payloadText = await response.text();
  let payload = {};
  try {
    payload = payloadText ? JSON.parse(payloadText) : {};
  } catch (_parseError) {
    payload = {};
  }

  if (response.ok) {
    return payload;
  }

  const rawMessage = String(payload?.error?.message || payload?.message || '').trim();
  const details = {
    status: response.status,
    error: rawMessage || payloadText
  };

  if (rawMessage === 'EMAIL_EXISTS') {
    throw serviceError(409, 'email_exists', 'An auth account already exists for this email', details);
  }
  if (rawMessage === 'EMAIL_NOT_FOUND' || rawMessage === 'USER_NOT_FOUND') {
    throw serviceError(404, 'email_not_found', 'No auth account exists for this email', details);
  }
  if (rawMessage === 'INVALID_EMAIL') {
    throw serviceError(400, 'invalid_email', 'Email address is invalid', details);
  }
  if (rawMessage === 'WEAK_PASSWORD') {
    throw serviceError(400, 'weak_password', 'Password must be at least 6 characters', details);
  }
  if (response.status === 403) {
    throw serviceError(500, 'firebase_admin_forbidden', 'Firebase Admin credential does not have the required Auth permissions', details);
  }

  throw serviceError(500, 'firebase_auth_request_failed', 'Firebase Auth admin request failed', details);
}

export async function createAuthUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');
  const payload = await identityToolkitRequest('/v1/accounts:signUp', {
    email: normalizedEmail,
    password: normalizedPassword,
    targetProjectId: getProjectId()
  });

  return {
    email: normalizedEmail,
    localId: String(payload.localId || ''),
    emailVerified: Boolean(payload.emailVerified)
  };
}

export async function sendPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const payload = await identityToolkitRequest('/v1/accounts:sendOobCode', {
    requestType: 'PASSWORD_RESET',
    email: normalizedEmail,
    targetProjectId: getProjectId()
  }, {
    includeApiKey: false
  });

  return {
    email: normalizedEmail,
    oobLink: payload.oobLink || ''
  };
}
