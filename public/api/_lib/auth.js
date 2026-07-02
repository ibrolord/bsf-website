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
const PERMISSION_CONTEXT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_AUTOMATION_PERMISSIONS = new Set([
  'volunteer_requests.approve',
  'volunteers.create',
  'volunteers.edit',
  'volunteers.delete',
  'ideas.edit_any',
  'ideas.delete_any',
  'forums.create',
  'forums.edit_any',
  'forums.delete_any',
  'forums.moderate',
  'team_forums.create',
  'team_forums.edit',
  'team_forums.delete',
  'team_forums.moderate',
  'ledger.create',
  'ledger.edit',
  'ledger.delete',
  'ledger.approve',
  'blog.approve',
  'blog.edit_any',
  'blog.delete_any',
  'sponsors.edit',
  'scholars.create',
  'scholars.edit',
  'schools.create',
  'schools.edit',
  'schools.delete',
  'announcements.create',
  'announcements.edit',
  'announcements.delete',
  'settings.edit',
  'users.assign_permissions',
  'events.create',
  'events.edit',
  'events.delete',
  'events.signup',
  'goals.create',
  'goals.edit',
  'goals.delete',
  'goals.update_progress',
  'outreach.create',
  'outreach.edit',
  'outreach.delete',
  'communities.create',
  'communities.edit',
  'communities.delete',
  'teams.create',
  'teams.edit',
  'teams.delete',
  'teams.manage_members',
  'kids.create',
  'kids.edit',
  'social.create',
  'social.edit',
  'social.approve',
  'social.delete',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'projects.manage_members',
  'tasks.assign'
]);
const ROLE_PERMISSIONS = {
  admin: new Set(['social.create', 'social.edit', 'social.approve', 'social.delete', 'volunteer_requests.approve', 'volunteers.create', 'volunteers.edit', 'volunteers.delete', 'ideas.edit_any', 'ideas.delete_any', 'forums.create', 'forums.edit_any', 'forums.delete_any', 'forums.moderate', 'team_forums.create', 'team_forums.edit', 'team_forums.delete', 'team_forums.moderate', 'ledger.create', 'ledger.edit', 'ledger.delete', 'ledger.approve', 'blog.approve', 'blog.edit_any', 'blog.delete_any', 'sponsors.edit', 'scholars.create', 'scholars.edit', 'schools.create', 'schools.edit', 'schools.delete', 'announcements.create', 'announcements.edit', 'announcements.delete', 'settings.edit', 'users.assign_permissions', 'events.create', 'events.edit', 'events.delete', 'events.signup', 'goals.create', 'goals.edit', 'goals.delete', 'goals.update_progress', 'outreach.create', 'outreach.edit', 'outreach.delete', 'communities.create', 'communities.edit', 'communities.delete', 'teams.create', 'teams.edit', 'teams.delete', 'teams.manage_members', 'kids.create', 'kids.edit', 'projects.create', 'projects.edit', 'projects.delete', 'projects.manage_members', 'tasks.assign']),
  program_lead: new Set(['volunteer_requests.approve', 'volunteers.create', 'volunteers.edit', 'volunteers.delete', 'team_forums.create', 'team_forums.edit', 'team_forums.delete', 'team_forums.moderate', 'blog.approve', 'blog.edit_any', 'blog.delete_any', 'scholars.create', 'scholars.edit', 'schools.create', 'schools.edit', 'schools.delete', 'events.create', 'events.edit', 'events.delete', 'events.signup', 'goals.create', 'goals.edit', 'goals.delete', 'goals.update_progress', 'outreach.create', 'outreach.edit', 'outreach.delete', 'communities.create', 'communities.edit', 'communities.delete', 'teams.create', 'teams.edit', 'teams.delete', 'teams.manage_members', 'kids.create', 'kids.edit', 'projects.create', 'projects.edit', 'projects.delete', 'projects.manage_members', 'tasks.assign']),
  comms: new Set(['ideas.edit_any', 'ideas.delete_any', 'forums.create', 'forums.edit_any', 'forums.delete_any', 'forums.moderate', 'team_forums.create', 'team_forums.edit', 'team_forums.delete', 'team_forums.moderate', 'blog.approve', 'blog.edit_any', 'blog.delete_any', 'announcements.create', 'announcements.edit', 'announcements.delete', 'social.create', 'social.edit', 'social.approve', 'social.delete']),
  moderator: new Set(['ideas.edit_any', 'ideas.delete_any', 'forums.create', 'forums.edit_any', 'forums.delete_any', 'forums.moderate', 'team_forums.create', 'team_forums.edit', 'team_forums.delete', 'team_forums.moderate']),
  finance: new Set(['ledger.create', 'ledger.edit', 'ledger.delete', 'ledger.approve', 'goals.create', 'goals.edit', 'goals.delete', 'goals.update_progress']),
  team_lead: new Set(['volunteer_requests.approve', 'ledger.approve', 'ledger.view', 'forums.create', 'team_forums.create', 'projects.create', 'projects.edit', 'projects.manage_members', 'tasks.assign']),
  volunteer: new Set(['forums.create', 'team_forums.create', 'ideas.create', 'events.signup', 'blog.create', 'blog.edit_own', 'blog.delete_own', 'sponsors.view']),
  viewer: new Set(['users.view', 'sponsors.view', 'blog.view', 'reports.view'])
};
let automationSessionCache = {
  email: '',
  password: '',
  expiresAt: 0,
  idToken: '',
  identity: null
};
const permissionContextCache = new Map();

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

function getPermissionCacheKey(identity, requestedPermissions) {
  return [
    String(identity && identity.uid || ''),
    String(identity && identity.email || ''),
    requestedPermissions.slice().sort().join(',')
  ].join('::');
}

function clonePermissionContext(context, idToken) {
  return {
    idToken: idToken,
    identity: Object.assign({}, context.identity),
    userDoc: context.userDoc ? JSON.parse(JSON.stringify(context.userDoc)) : null,
    roles: Array.isArray(context.roles) ? context.roles.slice() : [],
    isSuperAdmin: Boolean(context.isSuperAdmin),
    permission: context.permission
  };
}

function getCachedPermissionContext(identity, requestedPermissions, idToken) {
  const cacheKey = getPermissionCacheKey(identity, requestedPermissions);
  const cached = permissionContextCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) {
      permissionContextCache.delete(cacheKey);
    }
    return null;
  }
  return clonePermissionContext(cached.value, idToken);
}

function setCachedPermissionContext(identity, requestedPermissions, context) {
  permissionContextCache.set(getPermissionCacheKey(identity, requestedPermissions), {
    expiresAt: Date.now() + PERMISSION_CONTEXT_TTL_MS,
    value: clonePermissionContext(context, context.idToken)
  });
}

function hasPermissionFromRoles(roles, permission) {
  return roles.some(function(role) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions ? rolePermissions.has(permission) : false;
  });
}

function hasStoredPermission(userDoc, permission) {
  if (!userDoc || !Array.isArray(userDoc.permissions)) {
    return false;
  }
  return userDoc.permissions.includes(permission);
}

function hasExplicitOverride(userDoc, permission) {
  const overrides = userDoc && typeof userDoc === 'object'
    ? (userDoc.permission_overrides || userDoc.permissionOverrides || null)
    : null;
  if (!overrides || typeof overrides !== 'object') {
    return null;
  }
  if (!(permission in overrides)) {
    return null;
  }
  return Boolean(overrides[permission]);
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
    if (hasExplicitOverride(userDoc, permission) !== false && hasStoredPermission(userDoc, permission)) {
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
  const cachedContext = getCachedPermissionContext(identity, requestedPermissions, idToken);
  if (cachedContext) {
    return cachedContext;
  }

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

  const context = {
    idToken: idToken,
    identity: identity,
    userDoc: userDoc,
    roles: roles,
    isSuperAdmin: isSuperAdmin,
    permission: matchedPermission
  };
  setCachedPermissionContext(identity, requestedPermissions, context);
  return context;
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

// Returns a context-shaped actor for the configured automation identity,
// for server-to-server jobs (e.g. the social auto-drafter cron) that need an
// idToken to write to Firestore. The automation user must hold a Firestore
// role/permission that allows the writes it performs.
export async function getAutomationActor(automationName) {
  const email = String(process.env.BSF_AUTOMATION_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.BSF_AUTOMATION_PASSWORD || '');
  if (!email || !password) {
    throw httpError(500, 'missing_automation_configuration', 'Automation identity (BSF_AUTOMATION_EMAIL/PASSWORD) is not configured');
  }
  const session = await getAutomationSession(email, password);
  return {
    idToken: session.idToken,
    identity: session.identity,
    permission: 'social.create',
    isAutomation: true,
    automationName: String(automationName || 'internal-automation')
  };
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
