import { getDocument } from './firestore-rest.js';

const DEFAULT_FIREBASE_WEB_API_KEY = 'AIzaSyCwos6XR9-uqAf_Esmh2K_hJoLxq4gnEuU';
const SUPERADMIN_EMAILS = new Set([
  'admin@bigsisterfoundation.org',
  'bsfadmin@bigsisterfoundation.org',
  'princebolajibreeze@gmail.com',
  'bolajiagunbiade1@gmail.com'
]);
const ROLE_PERMISSIONS = {
  admin: new Set(['volunteer_requests.approve', 'volunteers.edit', 'ledger.approve', 'blog.approve', 'blog.edit_any']),
  program_lead: new Set(['volunteer_requests.approve', 'volunteers.edit', 'blog.approve', 'blog.edit_any']),
  comms: new Set(['blog.approve', 'blog.edit_any']),
  finance: new Set(['ledger.approve'])
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

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
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

export async function requireAnyPermission(request, permissions) {
  if (!isSameOriginIfPresent(request)) {
    throw httpError(403, 'invalid_origin', 'Request origin is not allowed');
  }

  const idToken = getBearerToken(request);
  if (!idToken) {
    throw httpError(401, 'missing_token', 'Authentication token is required');
  }

  const identity = await lookupIdentity(idToken);
  const isSuperAdmin = SUPERADMIN_EMAILS.has(identity.email);

  const userDocResult = await getDocument(idToken, 'users/' + identity.email);
  const userDoc = userDocResult.exists && userDocResult.document ? userDocResult.document.data : null;
  const roles = getRolesFromUserDoc(userDoc);
  const requestedPermissions = Array.isArray(permissions) ? permissions.filter(Boolean) : [permissions].filter(Boolean);

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

export async function requirePermission(request, permission) {
  return requireAnyPermission(request, [permission]);
}
