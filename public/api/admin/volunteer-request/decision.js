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
const PERMISSION = 'volunteer_requests.approve';
const decisionSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  status: z.enum(['approved', 'rejected'])
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-volunteer-request-decision' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Volunteer request decision failed');
}

async function persistAuditEntry(context, requestId, beforeStatus, afterStatus) {
  const changes = 'Status: ' + String(beforeStatus || 'pending') + ' -> ' + afterStatus;
  await createDocument(context.idToken, 'audit_log', {
    action: 'update',
    collection: 'volunteer_requests',
    documentId: requestId,
    changes: changes,
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/volunteer-request/decision',
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
  } catch (parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = decisionSchema.safeParse(payload || {});
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

  const requestId = parsed.data.requestId;
  const nextStatus = parsed.data.status;

  let volunteerRequest;
  try {
    volunteerRequest = await getDocument(context.idToken, 'volunteer_requests/' + requestId);
  } catch (readError) {
    log('error', {
      code: 'volunteer_request_read_failed',
      requestId: requestId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'volunteer_request_read_failed', 'Unable to load the volunteer request');
  }

  if (!volunteerRequest.exists || !volunteerRequest.document) {
    return error(404, 'not_found', 'Volunteer request not found', {
      requestId: requestId
    });
  }

  const existingData = volunteerRequest.document.data || {};
  const previousStatus = String(existingData.status || 'pending');
  if (previousStatus === nextStatus) {
    return json({
      ok: true,
      requestId: requestId,
      status: nextStatus,
      previousStatus: previousStatus,
      noChange: true
    });
  }

  try {
    await patchDocument(context.idToken, 'volunteer_requests/' + requestId, {
      status: nextStatus
    }, ['status']);
    const changes = await persistAuditEntry(context, requestId, previousStatus, nextStatus);

    log('log', {
      code: 'volunteer_request_status_updated',
      requestId: requestId,
      previousStatus: previousStatus,
      nextStatus: nextStatus,
      actor: context.identity.email
    });

    return json({
      ok: true,
      requestId: requestId,
      previousStatus: previousStatus,
      status: nextStatus,
      changes: changes,
      reviewedBy: context.identity.email
    });
  } catch (writeError) {
    log('error', {
      code: 'volunteer_request_write_failed',
      requestId: requestId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'volunteer_request_write_failed', 'Unable to update the volunteer request', {
      requestId: requestId
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
