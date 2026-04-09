import { z } from 'zod';

import { requireAnyPermission } from '../../_lib/auth.js';
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
const CREATE_PERMISSIONS = ['scholars.create', 'kids.create'];
const UPDATE_PERMISSIONS = ['scholars.edit', 'kids.edit'];
const scholarSchema = z.object({
  scholarId: z.string().trim().max(200).optional().default(''),
  name: z.string().trim().min(1).max(200),
  school: z.string().trim().min(1).max(200),
  pathway: z.string().trim().min(1).max(120),
  status: z.string().trim().min(1).max(120),
  performance: z.string().trim().max(120).default('Good'),
  extracurriculars: z.array(z.string().trim().min(1).max(120)).max(25).default([]),
  supportNotes: z.string().trim().max(5000).default(''),
  age: z.union([z.number().int().min(0).max(120), z.null()]).optional().default(null),
  gender: z.string().trim().max(50).default(''),
  story: z.string().trim().max(5000).default(''),
  background: z.string().trim().max(5000).default(''),
  goals: z.string().trim().max(5000).default(''),
  enrolledDate: z.string().trim().optional().default('')
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-scholar-save' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Scholar save failed');
}

function normalizeDate(dateString) {
  const trimmed = String(dateString || '').trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw error(400, 'invalid_enrolled_date', 'Enrolled date must be in YYYY-MM-DD format');
  }
  return new Date(trimmed + 'T12:00:00Z');
}

function buildScholarData(parsed) {
  const data = {
    name: parsed.name,
    school: parsed.school,
    pathway: parsed.pathway,
    status: parsed.status,
    performance: parsed.performance,
    extracurriculars: parsed.extracurriculars,
    supportNotes: parsed.supportNotes,
    age: parsed.age,
    gender: parsed.gender,
    story: parsed.story,
    background: parsed.background,
    goals: parsed.goals,
    lastEditedAt: new Date()
  };

  const enrolledDate = normalizeDate(parsed.enrolledDate);
  if (enrolledDate) {
    data.enrolledDate = enrolledDate;
  }

  return data;
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }
  if (left === null || right === null) {
    return left === right;
  }
  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left || null) === JSON.stringify(right || null);
  }
  return left === right;
}

function diffFields(previousData, nextData) {
  return Object.keys(nextData).filter(function(key) {
    return !valuesEqual(previousData ? previousData[key] : undefined, nextData[key]);
  });
}

async function persistAuditEntry(context, scholarId, mode, changes) {
  const permission = context.permission || (mode === 'create' ? CREATE_PERMISSIONS[0] : UPDATE_PERMISSIONS[0]);
  await createDocument(context.idToken, 'audit_log', {
    action: mode,
    collection: 'scholars',
    documentId: scholarId,
    changes: changes,
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/scholar/save',
      permission: permission,
      automation: Boolean(context.isAutomation),
      automationName: context.automationName || ''
    }
  });
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = scholarSchema.safeParse(payload || {});
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

  const scholarId = String(parsed.data.scholarId || '').trim();
  const isUpdate = Boolean(scholarId);

  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? UPDATE_PERMISSIONS : CREATE_PERMISSIONS);
  } catch (authError) {
    return errorFromException(authError);
  }

  let scholarData;
  try {
    scholarData = buildScholarData(parsed.data);
  } catch (buildError) {
    return errorFromException(buildError);
  }

  if (isUpdate) {
    let scholarDocument;
    try {
      scholarDocument = await getDocument(context.idToken, 'scholars/' + scholarId);
    } catch (readError) {
      log('error', {
        code: 'scholar_read_failed',
        scholarId: scholarId,
        actor: context.identity.email,
        status: readError.status || 500,
        message: readError.message
      });
      return error(500, 'scholar_read_failed', 'Unable to load the scholar record');
    }

    if (!scholarDocument.exists || !scholarDocument.document) {
      return error(404, 'not_found', 'Scholar not found', {
        scholarId: scholarId
      });
    }

    const previousData = scholarDocument.document.data || {};
    const changedFields = diffFields(previousData, scholarData).filter(function(field) {
      return field !== 'lastEditedAt';
    });

    try {
      await patchDocument(context.idToken, 'scholars/' + scholarId, scholarData, Object.keys(scholarData));
      const changes = changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes';
      await persistAuditEntry(context, scholarId, 'update', changes);

      log('log', {
        code: 'scholar_updated',
        scholarId: scholarId,
        actor: context.identity.email,
        changedFields: changedFields,
        automation: Boolean(context.isAutomation)
      });

      return json({
        ok: true,
        scholarId: scholarId,
        mode: 'update',
        changedFields: changedFields,
        reviewedBy: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
    } catch (writeError) {
      log('error', {
        code: 'scholar_update_failed',
        scholarId: scholarId,
        actor: context.identity.email,
        status: writeError.status || 500,
        message: writeError.message,
        body: writeError.body || ''
      });
      return error(500, 'scholar_update_failed', 'Unable to update the scholar record', {
        scholarId: scholarId
      });
    }
  }

  const createData = Object.assign({}, scholarData, {
    createdAt: new Date()
  });

  try {
    const created = await createDocument(context.idToken, 'scholars', createData);
    await persistAuditEntry(context, created.id, 'create', 'Created: ' + parsed.data.name);

    log('log', {
      code: 'scholar_created',
      scholarId: created.id,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });

    return json({
      ok: true,
      scholarId: created.id,
      mode: 'create',
      reviewedBy: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
  } catch (createError) {
    log('error', {
      code: 'scholar_create_failed',
      actor: context.identity.email,
      status: createError.status || 500,
      message: createError.message,
      body: createError.body || ''
    });
    return error(500, 'scholar_create_failed', 'Unable to create the scholar record');
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
