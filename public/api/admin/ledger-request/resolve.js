import { z } from 'zod';

import { requirePermission } from '../../_lib/auth.js';
import {
  createDocument,
  deleteDocument,
  getDocument,
  patchDocument
} from '../../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  sendNodeResponse
} from '../../_lib/response.js';

const ALLOWED_METHODS = ['POST'];
const PERMISSION = 'ledger.approve';
const resolveSchema = z.object({
  requestId: z.string().trim().min(1).max(200),
  decision: z.enum(['approved', 'rejected'])
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-ledger-request-resolve' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Ledger request resolution failed');
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data || {}));
}

function diffFields(previousData, nextData) {
  if (!previousData) {
    return 'Created';
  }
  const skipKeys = new Set(['lastEditedAt', 'createdAt', '_id']);
  const changes = [];

  Object.keys(nextData || {}).forEach(function(key) {
    if (skipKeys.has(key)) {
      return;
    }
    const beforeValue = Array.isArray(previousData[key]) || (previousData[key] && typeof previousData[key] === 'object')
      ? JSON.stringify(previousData[key])
      : String(previousData[key] == null ? '' : previousData[key]);
    const afterValue = Array.isArray(nextData[key]) || (nextData[key] && typeof nextData[key] === 'object')
      ? JSON.stringify(nextData[key])
      : String(nextData[key] == null ? '' : nextData[key]);
    if (beforeValue !== afterValue) {
      changes.push(key + ': "' + beforeValue + '" -> "' + afterValue + '"');
    }
  });

  return changes.length ? changes.join('; ') : 'No changes';
}

async function writeAuditEntry(context, payload) {
  await createDocument(context.idToken, 'audit_log', {
    action: payload.action,
    collection: payload.collection,
    documentId: payload.documentId || '',
    changes: payload.changes || '',
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/ledger-request/resolve',
      permission: PERMISSION
    }
  });
}

async function resolveApprovedRequest(context, requestId, requestData) {
  const requestedBy = String(requestData.requestedBy || '');
  let ledgerAction = 'none';
  let ledgerDocumentId = '';

  if (requestData.type === 'add' && requestData.proposedData) {
    const ledgerData = cloneData(requestData.proposedData);
    ledgerData.createdAt = new Date();
    ledgerData.lastEditedAt = new Date();
    ledgerData.notes = 'Added via approved request from ' + requestedBy;
    const createdLedger = await createDocument(context.idToken, 'ledger', ledgerData);
    ledgerAction = 'create';
    ledgerDocumentId = createdLedger.id;
    await writeAuditEntry(context, {
      action: 'create',
      collection: 'ledger',
      documentId: createdLedger.id,
      changes: 'Via approved request: ' + String(ledgerData.description || '')
    });
  } else if (requestData.type === 'edit' && requestData.entryId && requestData.proposedData) {
    const existingLedger = await getDocument(context.idToken, 'ledger/' + requestData.entryId);
    if (!existingLedger.exists || !existingLedger.document) {
      return {
        errorResponse: error(404, 'ledger_entry_not_found', 'Ledger entry not found for edit request', {
          entryId: requestData.entryId
        })
      };
    }
    const ledgerData = cloneData(requestData.proposedData);
    ledgerData.lastEditedAt = new Date();
    ledgerData.notes = String(ledgerData.notes || '') + ' Updated via approved request from ' + requestedBy;
    await patchDocument(context.idToken, 'ledger/' + requestData.entryId, ledgerData, Object.keys(ledgerData));
    ledgerAction = 'update';
    ledgerDocumentId = requestData.entryId;
    await writeAuditEntry(context, {
      action: 'update',
      collection: 'ledger',
      documentId: requestData.entryId,
      changes: 'Via approved request: ' + diffFields(existingLedger.document.data || {}, ledgerData)
    });
  } else if (requestData.type === 'delete' && requestData.entryId) {
    await deleteDocument(context.idToken, 'ledger/' + requestData.entryId);
    ledgerAction = 'delete';
    ledgerDocumentId = requestData.entryId;
    await writeAuditEntry(context, {
      action: 'delete',
      collection: 'ledger',
      documentId: requestData.entryId,
      changes: 'Via approved request from ' + requestedBy
    });
  }

  await patchDocument(context.idToken, 'ledger_requests/' + requestId, {
    status: 'approved',
    reviewedBy: context.identity.email,
    reviewedAt: new Date(),
    resolvedBy: 'admin_override'
  }, ['status', 'reviewedBy', 'reviewedAt', 'resolvedBy']);

  await writeAuditEntry(context, {
    action: 'update',
    collection: 'ledger_requests',
    documentId: requestId,
    changes: 'Approved ' + String(requestData.type || 'ledger') + ' request from ' + requestedBy + ' (admin override)'
  });

  return {
    response: json({
      ok: true,
      requestId: requestId,
      previousStatus: 'pending',
      status: 'approved',
      reviewedBy: context.identity.email,
      resolvedBy: 'admin_override',
      ledgerAction: ledgerAction,
      ledgerDocumentId: ledgerDocumentId
    })
  };
}

async function resolveRejectedRequest(context, requestId, requestData) {
  await patchDocument(context.idToken, 'ledger_requests/' + requestId, {
    status: 'rejected',
    reviewedBy: context.identity.email,
    reviewedAt: new Date(),
    resolvedBy: 'admin_override'
  }, ['status', 'reviewedBy', 'reviewedAt', 'resolvedBy']);

  await writeAuditEntry(context, {
    action: 'update',
    collection: 'ledger_requests',
    documentId: requestId,
    changes: 'Rejected request from ' + String(requestData.requestedBy || '') + ' (admin override)'
  });

  return json({
    ok: true,
    requestId: requestId,
    previousStatus: 'pending',
    status: 'rejected',
    reviewedBy: context.identity.email,
    resolvedBy: 'admin_override',
    ledgerAction: 'none',
    ledgerDocumentId: ''
  });
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

  const parsed = resolveSchema.safeParse(payload || {});
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
  const decision = parsed.data.decision;

  let ledgerRequest;
  try {
    ledgerRequest = await getDocument(context.idToken, 'ledger_requests/' + requestId);
  } catch (readError) {
    log('error', {
      code: 'ledger_request_read_failed',
      requestId: requestId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'ledger_request_read_failed', 'Unable to load the ledger request');
  }

  if (!ledgerRequest.exists || !ledgerRequest.document) {
    return error(404, 'not_found', 'Ledger request not found', {
      requestId: requestId
    });
  }

  const requestData = ledgerRequest.document.data || {};
  const previousStatus = String(requestData.status || 'pending');
  if (previousStatus === decision) {
    return json({
      ok: true,
      requestId: requestId,
      status: decision,
      previousStatus: previousStatus,
      noChange: true
    });
  }

  if (previousStatus !== 'pending') {
    return error(409, 'request_already_resolved', 'Ledger request is no longer pending', {
      requestId: requestId,
      status: previousStatus
    });
  }

  try {
    if (decision === 'approved') {
      const approvalResult = await resolveApprovedRequest(context, requestId, requestData);
      if (approvalResult.errorResponse) {
        return approvalResult.errorResponse;
      }
      log('log', {
        code: 'ledger_request_approved',
        requestId: requestId,
        actor: context.identity.email,
        type: requestData.type || '',
        entryId: requestData.entryId || ''
      });
      return approvalResult.response;
    }

    const rejectionResponse = await resolveRejectedRequest(context, requestId, requestData);
    log('log', {
      code: 'ledger_request_rejected',
      requestId: requestId,
      actor: context.identity.email,
      type: requestData.type || '',
      entryId: requestData.entryId || ''
    });
    return rejectionResponse;
  } catch (writeError) {
    log('error', {
      code: 'ledger_request_resolve_failed',
      requestId: requestId,
      actor: context.identity.email,
      decision: decision,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'ledger_request_resolve_failed', 'Unable to resolve the ledger request', {
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
