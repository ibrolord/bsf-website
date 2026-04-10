import { z } from 'zod';

import { requirePermission } from '../_lib/auth.js';
import { createDocument } from '../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  sendNodeResponse
} from '../_lib/response.js';

const ALLOWED_METHODS = ['POST'];
const PERMISSION = 'volunteers.edit';
const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(200).optional().default(''),
  role: z.string().trim().min(1).max(50).optional().default('volunteer')
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-volunteer-invite' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Volunteer invite failed');
}

function buildInviteLink(request, inviteId) {
  const url = new URL('/volunteer/', request.url);
  url.searchParams.set('invite', inviteId);
  return url.toString();
}

async function persistAuditEntry(context, inviteDocument, inviteData) {
  const inviteLabel = inviteData.name || inviteData.email;
  const changes = 'Invite: ' + inviteLabel;
  await createDocument(context.idToken, 'audit_log', {
    action: 'create',
    collection: 'invites',
    documentId: inviteDocument.id,
    changes: changes,
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/volunteer-invite',
      permission: PERMISSION
    }
  });
  return changes;
}

export async function POST(request) {
  let context;
  try {
    context = await requirePermission(request, PERMISSION);
  } catch (authError) {
    return errorFromException(authError);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = inviteSchema.safeParse(payload || {});
  if (!parsed.success) {
    return error(400, 'invalid_payload', 'Request payload did not match the expected shape', {
      issues: parsed.error.issues.map(function(issue) {
        return {
          path: issue.path.join('.'),
          message: issue.message
        };
      })
    });
  }

  const inviteData = {
    email: parsed.data.email.toLowerCase(),
    name: parsed.data.name || '',
    role: parsed.data.role || 'volunteer',
    invitedBy: context.identity.email,
    invitedAt: new Date(),
    status: 'pending'
  };

  try {
    const inviteDocument = await createDocument(context.idToken, 'invites', inviteData);
    const changes = await persistAuditEntry(context, inviteDocument, inviteData);
    const inviteLink = buildInviteLink(request, inviteDocument.id);

    log('log', {
      code: 'volunteer_invite_created',
      inviteId: inviteDocument.id,
      inviteeEmail: inviteData.email,
      role: inviteData.role,
      actor: context.identity.email
    });

    return json({
      ok: true,
      inviteId: inviteDocument.id,
      inviteLink: inviteLink,
      email: inviteData.email,
      role: inviteData.role,
      invitedBy: context.identity.email,
      changes: changes
    });
  } catch (writeError) {
    log('error', {
      code: 'volunteer_invite_write_failed',
      actor: context.identity.email,
      email: inviteData.email,
      role: inviteData.role,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'volunteer_invite_write_failed', 'Unable to create the volunteer invite', {
      email: inviteData.email
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendNodeResponse(methodNotAllowed(ALLOWED_METHODS), res);
  }

  const headers = nodeHeadersToWebHeaders(req.headers);
  const body = nodeRequestBodyToString(req);
  const requestUrl = new URL(req.url, 'https://' + (headers.get('host') || 'thebigsisterfoundation.org'));
  const request = new Request(requestUrl.toString(), {
    method: 'POST',
    headers: headers,
    body: body
  });

  return sendNodeResponse(await POST(request), res);
}
