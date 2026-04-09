import { z } from 'zod';

import { requirePermission } from '../../_lib/auth.js';
import { createDocument, getDocument, patchDocument } from '../../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  sendNodeResponse
} from '../../_lib/response.js';

const ALLOWED_METHODS = ['POST'];
const PERMISSION = 'sponsors.edit';
const statusSchema = z.object({
  sponsorId: z.string().trim().min(1).max(200),
  status: z.enum(['active', 'suspended'])
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-sponsor-status' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Sponsor status update failed');
}

async function persistAuditEntry(context, sponsorId, previousStatus, nextStatus) {
  const changes = 'Status: ' + String(previousStatus || 'active') + ' -> ' + nextStatus;
  await createDocument(context.idToken, 'audit_log', {
    action: 'update',
    collection: 'sponsors',
    documentId: sponsorId,
    changes: changes,
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/sponsor/status',
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

  const parsed = statusSchema.safeParse(payload || {});
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

  const sponsorId = parsed.data.sponsorId;
  const nextStatus = parsed.data.status;

  let sponsorDocument;
  try {
    sponsorDocument = await getDocument(context.idToken, 'sponsors/' + sponsorId);
  } catch (readError) {
    log('error', {
      code: 'sponsor_read_failed',
      sponsorId: sponsorId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'sponsor_read_failed', 'Unable to load the sponsor record');
  }

  if (!sponsorDocument.exists || !sponsorDocument.document) {
    return error(404, 'not_found', 'Sponsor not found', {
      sponsorId: sponsorId
    });
  }

  const existingData = sponsorDocument.document.data || {};
  const previousStatus = String(existingData.status || 'active');
  if (previousStatus === nextStatus) {
    return json({
      ok: true,
      sponsorId: sponsorId,
      previousStatus: previousStatus,
      status: nextStatus,
      noChange: true
    });
  }

  try {
    await patchDocument(context.idToken, 'sponsors/' + sponsorId, {
      status: nextStatus,
      lastEditedAt: new Date()
    }, ['status', 'lastEditedAt']);
    const changes = await persistAuditEntry(context, sponsorId, previousStatus, nextStatus);

    log('log', {
      code: 'sponsor_status_updated',
      sponsorId: sponsorId,
      actor: context.identity.email,
      previousStatus: previousStatus,
      nextStatus: nextStatus,
      automation: Boolean(context.isAutomation)
    });

    return json({
      ok: true,
      sponsorId: sponsorId,
      previousStatus: previousStatus,
      status: nextStatus,
      reviewedBy: context.identity.email,
      changes: changes,
      automation: Boolean(context.isAutomation)
    });
  } catch (writeError) {
    log('error', {
      code: 'sponsor_status_write_failed',
      sponsorId: sponsorId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'sponsor_status_write_failed', 'Unable to update the sponsor record', {
      sponsorId: sponsorId
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
