import { timingSafeEqual } from 'node:crypto';

import { getDocument } from './firestore-rest.js';

const DEFAULT_FIREBASE_WEB_API_KEY = 'AIzaSyCwos6XR9-uqAf_Esmh2K_hJoLxq4gnEuU';
const SUPERADMIN_EMAILS = new Set([
  'admin@bigsisterfoundation.org',
  'bsfadmin@bigsisterfoundation.org',
  'princebolajibreeze@gmail.com',
  'bolajiagunbiade1@gmail.com'
]);
const AUTOMATION_KEY_HEADER = 'x-bsf-automation-key';
const AUTOMATION_NAME_HEADER = 'x-bsf-automation-name';
const DEFAULT_AUTOMATION_PERMISSIONS = new Set([
  'volunteer_requests.approve',
  'volunteers.edit',
  'ledger.approve',
  'blog.approve',
  'blog.edit_any',
  'sponsors.edit',
  'scholars.create',
  'scholars.edit',
  'kids.create',
  'kids.edit'
]);
const ROLE_PERMISSIONS = {
  admin: new Set(['volunteer_requests.approve', 'volunteers.edit', 'ledger.approve', 'blog.approve', 'blog.edit_any', 'sponsors.edit', 'scholars.create', 'scholars.edit', 'kids.create', 'kids.edit']),
  program_lead: new Set(['volunteer_requests.approve', 'volunteers.edit', 'blog.approve', 'blog.edit_any', 'scholars.create', 'scholars.edit', 'kids.create', 'kids.edit']),
  comms: new Set(['blog.approve', 'blog.edit_any']),
  finance: new Set(['ledger.approve'])
};
let automationSessionCache = {
  email: '',
  password: '',
  expiresAt: 0,
  idToken: '',
  identity: null
};

function getApiKey() {
  return process.env.FIREBASE_WEB_API_KEY || DEFAULT_FIREBASE_WEB_API_KEY;
}

function httpError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details || {};
  return error;
}

function getAutomationKey(request) {
  return String(request.headers.get(AUTOMATION_KEY_HEADER) || '').trim();
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function getAutomationAllowedPermissions() {
  const configured = String(process.env.BSF_AUTOMATION_PERMISSIONS || '').trim();
  if (!configured) {
    return new Set(DEFAULT_AUTOMATION_PERMISSIONS);
  }
  return new Set(configured.split(',').map(function(permission) {
    return permission.trim();
  }).filter(Boolean));
}

function secretsMatch(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getRolesFromUserDoc(userDoc) {
  if (!userDoc || typeof userDoc !== 'object') {
    return [];
  }
  if (Array.isArray(userDoc.roles)) {
    return userDoc.roles.filter(Boolean);
  }
  if (userDoc.role) {
    return [userDoc.role];
  }
  return [];
}

function hasPermissionFromRoles(roles, permission) {
  return roles.some(function(role) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions ? rolePermissions.has(permission) : false;
  });
}

function hasExplicitOverride(userDoc, permission) {
  if (!userDoc || !userDoc.permission_overrides || typeof userDoc.permission_overrides !== 'object') {
    return null;
  }
  if (!(permission in userDoc.permission_overrides)) {
    return null;
  }
  return Boolean(userDoc.permission_overrides[permission]);
}

function resolveAllowedPermission(roles, userDoc, permissions, isSuperAdmin) {
  const requestedPermissions = Array.isArray(permissions) ? permissions : [permissions];

  if (isSuperAdmin) {
    return requestedPermissions[0] || '';
  }

  for (const permission of requestedPermissions) {
    if (hasExplicitOverride(userDoc, permission) === true) {
      return permission;
    }
  }

  for (const permission of requestedPermissions) {
    if (hasExplicitOverride(userDoc, permission) === null && hasPermissionFromRoles(roles, permission)) {
      return permission;
    }
  }

  return '';
}

function isSameOriginIfPresent(request) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return true;
  }
  const url = new URL(request.url);
  return origin === url.origin;
}

async function lookupIdentity(idToken) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(getApiKey()), {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({ idToken: idToken })
  });

  if (!response.ok) {
    throw httpError(401, 'invalid_token', 'Firebase token verification failed');
  }

  const payload = await response.json();
  const user = Array.isArray(payload.users) ? payload.users[0] : null;
  if (!user || !user.email) {
    throw httpError(401, 'invalid_token', 'Firebase token verification failed');
  }

  return {
    uid: user.localId || '',
    email: String(user.email || '').toLowerCase(),
    emailVerified: Boolean(user.emailVerified)
  };
}

async function signInWithEmailPassword(email, password) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(getApiKey()), {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      email: email,
      password: password,
      returnSecureToken: true
    })
  });

  if (!response.ok) {
    throw httpError(500, 'automation_signin_failed', 'Automation identity sign-in failed');
  }

  const payload = await response.json();
  if (!payload || !payload.idToken || !payload.email) {
    throw httpError(500, 'automation_signin_failed', 'Automation identity sign-in failed');
  }

  return {
    idToken: payload.idToken,
    expiresAt: Date.now() + Math.max(60, Number(payload.expiresIn || 3600) - 60) * 1000,
    identity: {
      uid: String(payload.localId || ''),
      email: String(payload.email || '').toLowerCase(),
      emailVerified: true
    }
  };
}

async function getAutomationSession(email, password) {
  if (
    automationSessionCache.idToken &&
    automationSessionCache.email === email &&
    automationSessionCache.password === password &&
    automationSessionCache.expiresAt > Date.now()
  ) {
    return automationSessionCache;
  }

  const session = await signInWithEmailPassword(email, password);
  automationSessionCache = {
    email: email,
    password: password,
    expiresAt: session.expiresAt,
    idToken: session.idToken,
    identity: session.identity
  };
  return automationSessionCache;
}

async function resolvePermissionContext(idToken, identity, requestedPermissions) {
  const isSuperAdmin = SUPERADMIN_EMAILS.has(identity.email);
  const userDocResult = await getDocument(idToken, 'users/' + identity.email);
  const userDoc = userDocResult.exists && userDocResult.document ? userDocResult.document.data : null;
  const roles = getRolesFromUserDoc(userDoc);

  let matchedPermission = resolveAllowedPermission(roles, userDoc, requestedPermissions, isSuperAdmin);
  if (!matchedPermission) {
    let adminDocResult = { exists: false };
    if (identity.uid) {
      try {
        adminDocResult = await getDocument(idToken, 'admins/' + identity.uid);
      } catch (adminDocError) {
        if (adminDocError.status !== 403) {
          throw adminDocError;
        }
      }
    }
    const adminDoc = adminDocResult.exists && adminDocResult.document ? adminDocResult.document.data : null;
    const adminRole = adminDoc && typeof adminDoc.role === 'string' ? adminDoc.role.toLowerCase() : '';
    if (adminRole === 'admin' || adminRole === 'superadmin') {
      matchedPermission = requestedPermissions[0] || '';
    }
  }

  if (!matchedPermission) {
    throw httpError(403, 'forbidden', 'You do not have permission to perform this action', {
      permissions: requestedPermissions
    });
  }

  return {
    idToken: idToken,
    identity: identity,
    userDoc: userDoc,
    roles: roles,
    isSuperAdmin: isSuperAdmin,
    permission: matchedPermission
  };
}

async function resolveAutomationContext(request, requestedPermissions) {
  const providedKey = getAutomationKey(request);
  if (!providedKey) {
    return null;
  }

  const configuredKey = String(process.env.BSF_AUTOMATION_KEY || '').trim();
  const automationEmail = String(process.env.BSF_AUTOMATION_EMAIL || '').trim().toLowerCase();
  const automationPassword = String(process.env.BSF_AUTOMATION_PASSWORD || '');
  if (!configuredKey || !automationEmail || !automationPassword) {
    throw httpError(500, 'missing_automation_configuration', 'Automation identity is not configured');
  }

  if (!secretsMatch(providedKey, configuredKey)) {
    throw httpError(401, 'invalid_automation_key', 'Automation key is invalid');
  }

  const allowedPermissions = getAutomationAllowedPermissions();
  const filteredPermissions = requestedPermissions.filter(function(permission) {
    return allowedPermissions.has(permission);
  });
  if (!filteredPermissions.length) {
    throw httpError(403, 'forbidden', 'Automation identity does not allow this action', {
      permissions: requestedPermissions
    });
  }

  const session = await getAutomationSession(automationEmail, automationPassword);
  const context = await resolvePermissionContext(session.idToken, session.identity, filteredPermissions);
  context.isAutomation = true;
  context.automationName = String(request.headers.get(AUTOMATION_NAME_HEADER) || 'internal-automation').trim() || 'internal-automation';
  return context;
}

export async function requireAnyPermission(request, permissions) {
  const requestedPermissions = Array.isArray(permissions) ? permissions.filter(Boolean) : [permissions].filter(Boolean);
  const automationContext = await resolveAutomationContext(request, requestedPermissions);
  if (automationContext) {
    return automationContext;
  }

  if (!isSameOriginIfPresent(request)) {
    throw httpError(403, 'invalid_origin', 'Request origin is not allowed');
  }

  const idToken = getBearerToken(request);
  if (!idToken) {
    throw httpError(401, 'missing_token', 'Authentication token is required');
  }

  const identity = await lookupIdentity(idToken);
  return resolvePermissionContext(idToken, identity, requestedPermissions);
}

export async function requirePermission(request, permission) {
  return requireAnyPermission(request, [permission]);
}
