import { z } from 'zod';

import { requirePermission } from '../_lib/auth.js';
import { createAuthUser, sendPasswordReset } from '../_lib/firebase-auth-admin.js';
import { createDocument } from '../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  nodeRequestUrl,
  sendNodeResponse
} from '../_lib/response.js';

const ALLOWED_METHODS = ['POST'];
const PERMISSION = 'users.assign_permissions';

const createAuthUserSchema = z.object({
  action: z.literal('create_auth_user'),
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200)
});

const sendPasswordResetSchema = z.object({
  action: z.literal('send_password_reset'),
  email: z.string().trim().email().max(320)
});

const requestSchema = z.discriminatedUnion('action', [
  createAuthUserSchema,
  sendPasswordResetSchema
]);

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-team-member' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Team member request failed');
}

async function writeAudit(context, details) {
  await createDocument(context.idToken, 'audit_log', {
    action: details.action,
    collection: 'users',
    documentId: details.documentId || '',
    changes: details.changes || '',
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/team-member',
      permission: context.permission,
      automation: Boolean(context.isAutomation)
    }
  });
}

async function handleCreateAuthUser(request, data) {
  let context;
  try {
    context = await requirePermission(request, PERMISSION);
  } catch (authError) {
    return errorFromException(authError);
  }

  try {
    const createdUser = await createAuthUser(data.email, data.password);
    await writeAudit(context, {
      action: 'create',
      documentId: createdUser.email,
      changes: 'Created Firebase Auth account'
    });
    return json({
      ok: true,
      action: 'create_auth_user',
      email: createdUser.email,
      uid: createdUser.localId,
      reviewedBy: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
  } catch (createError) {
    return errorFromException(createError);
  }
}

async function handleSendPasswordReset(request, data) {
  let context;
  try {
    context = await requirePermission(request, PERMISSION);
  } catch (authError) {
    return errorFromException(authError);
  }

  try {
    await sendPasswordReset(data.email);
    await writeAudit(context, {
      action: 'update',
      documentId: String(data.email || '').trim().toLowerCase(),
      changes: 'Sent password reset email'
    });
    return json({
      ok: true,
      action: 'send_password_reset',
      email: String(data.email || '').trim().toLowerCase(),
      reviewedBy: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
  } catch (resetError) {
    return errorFromException(resetError);
  }
}

async function handleRequest(request) {
  if (!ALLOWED_METHODS.includes(request.method)) {
    return methodNotAllowed(ALLOWED_METHODS);
  }

  let body;
  try {
    body = request.method === 'POST' ? await request.json() : {};
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = requestSchema.safeParse(body || {});
  if (!parsed.success) {
    return error(400, 'invalid_payload', 'Request body is invalid', {
      issues: parsed.error.issues.map(function(issue) {
        return {
          path: issue.path.join('.'),
          message: issue.message
        };
      })
    });
  }

  if (parsed.data.action === 'create_auth_user') {
    return handleCreateAuthUser(request, parsed.data);
  }
  return handleSendPasswordReset(request, parsed.data);
}

export default async function handler(req, res) {
  const headers = nodeHeadersToWebHeaders(req.headers);
  const body = nodeRequestBodyToString(req);
  const requestUrl = nodeRequestUrl(req, headers, 'thebigsisterfoundation.org');
  const request = new Request(requestUrl.toString(), {
    method: req.method,
    headers: headers,
    body: body
  });

  try {
    const response = await handleRequest(request);
    await sendNodeResponse(response, res);
  } catch (unexpectedError) {
    log('error', {
      message: unexpectedError.message,
      stack: unexpectedError.stack || ''
    });
    await sendNodeResponse(error(500, 'internal_error', 'Team member request failed'), res);
  }
}
