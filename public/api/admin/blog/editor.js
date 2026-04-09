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
const PERMISSION = 'blog.edit_any';
const MAX_TEXT = 50000;

const legacyLocalIdSchema = z.union([
  z.string().trim().max(200),
  z.number().int().safe()
]).optional();

const saveSchema = z.object({
  action: z.literal('save'),
  firestoreId: z.string().trim().max(200).optional().default(''),
  legacyLocalId: legacyLocalIdSchema,
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  author: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(1000).optional().default(''),
  body: z.string().trim().min(1).max(MAX_TEXT),
  keywords: z.array(z.string().trim().min(1).max(120)).max(50).optional().default([]),
  metaDescription: z.string().trim().max(500).optional().default(''),
  status: z.enum(['published', 'draft', 'pending', 'approved', 'rejected']).optional().default('published'),
  readTime: z.number().int().min(1).max(1000),
  date: z.string().trim().max(40).optional().default('')
});

const deleteSchema = z.object({
  action: z.literal('delete'),
  firestoreId: z.string().trim().max(200).optional().default(''),
  legacyLocalId: legacyLocalIdSchema,
  title: z.string().trim().max(200).optional().default('')
});

const requestSchema = z.discriminatedUnion('action', [saveSchema, deleteSchema]);

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-blog-editor' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Blog editor request failed');
}

function normalizeLegacyLocalId(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return String(value).trim();
}

function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

function buildCanonicalBlogData(input, existingData, actorEmail, legacyLocalId) {
  const now = new Date();
  const base = existingData && typeof existingData === 'object' ? existingData : {};
  const nextData = {
    title: input.title,
    category: input.category,
    author: input.author || base.author || actorEmail,
    excerpt: input.excerpt || '',
    body: input.body,
    keywords: Array.isArray(input.keywords) ? input.keywords : [],
    metaDescription: input.metaDescription || '',
    status: input.status || base.status || 'published',
    readTime: Math.max(1, Number(input.readTime || 1)),
    date: input.date || base.date || todayIsoDate(),
    aiGenerated: false,
    updatedAt: now,
    updatedBy: actorEmail
  };

  if (base.createdAt) {
    nextData.createdAt = base.createdAt;
  } else {
    nextData.createdAt = now;
  }

  if (base.createdBy) {
    nextData.createdBy = base.createdBy;
  } else {
    nextData.createdBy = actorEmail;
  }

  if (base.submittedBy !== undefined) {
    nextData.submittedBy = base.submittedBy;
  }
  if (base.submittedAt !== undefined) {
    nextData.submittedAt = base.submittedAt;
  }
  if (base.approvedBy !== undefined) {
    nextData.approvedBy = base.approvedBy;
  }
  if (base.approvedAt !== undefined) {
    nextData.approvedAt = base.approvedAt;
  }
  if (base.rejectedBy !== undefined) {
    nextData.rejectedBy = base.rejectedBy;
  }
  if (base.rejectedAt !== undefined) {
    nextData.rejectedAt = base.rejectedAt;
  }
  if (base.rejectionReason !== undefined) {
    nextData.rejectionReason = base.rejectionReason;
  }
  if (legacyLocalId) {
    nextData.migratedFromLegacyId = legacyLocalId;
  } else if (base.migratedFromLegacyId !== undefined) {
    nextData.migratedFromLegacyId = base.migratedFromLegacyId;
  }

  return nextData;
}

function buildAuditChanges(action, payload) {
  const details = [];
  if (payload.title) {
    details.push('Title: ' + String(payload.title));
  }
  if (payload.status) {
    details.push('Status: ' + String(payload.status));
  }
  if (payload.legacyLocalId) {
    details.push('Legacy local id: ' + String(payload.legacyLocalId));
  }
  if (payload.note) {
    details.push(String(payload.note));
  }
  return details.join('; ') || action;
}

async function persistAuditEntry(context, action, documentId, changes) {
  await createDocument(context.idToken, 'audit_log', {
    action: action,
    collection: 'blog_posts',
    documentId: documentId || '',
    changes: changes || '',
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/blog/editor',
      permission: context.permission,
      automation: Boolean(context.isAutomation)
    }
  });
}

async function handleSave(context, data) {
  const firestoreId = String(data.firestoreId || '').trim();
  const legacyLocalId = normalizeLegacyLocalId(data.legacyLocalId);

  if (firestoreId) {
    const existing = await getDocument(context.idToken, 'blog_posts/' + firestoreId);
    if (!existing.exists || !existing.document) {
      return error(404, 'not_found', 'Blog post not found', { firestoreId: firestoreId });
    }

    const nextData = buildCanonicalBlogData(data, existing.document.data || {}, context.identity.email, legacyLocalId);
    await patchDocument(context.idToken, 'blog_posts/' + firestoreId, nextData, Object.keys(nextData));
    const changes = buildAuditChanges('update', {
      title: data.title,
      status: nextData.status,
      legacyLocalId: legacyLocalId,
      note: 'Updated admin blog post'
    });
    await persistAuditEntry(context, 'update', firestoreId, changes);

    return json({
      ok: true,
      action: 'save',
      mode: 'update',
      firestoreId: firestoreId,
      legacyLocalId: legacyLocalId,
      reviewedBy: context.identity.email,
      changes: changes
    });
  }

  const created = await createDocument(
    context.idToken,
    'blog_posts',
    buildCanonicalBlogData(data, null, context.identity.email, legacyLocalId)
  );
  const changes = buildAuditChanges('create', {
    title: data.title,
    status: data.status,
    legacyLocalId: legacyLocalId,
    note: legacyLocalId ? 'Created canonical Firestore post from legacy local post' : 'Created admin blog post'
  });
  await persistAuditEntry(context, 'create', created.id, changes);

  return json({
    ok: true,
    action: 'save',
    mode: 'create',
    firestoreId: created.id,
    legacyLocalId: legacyLocalId,
    migrated: Boolean(legacyLocalId),
    reviewedBy: context.identity.email,
    changes: changes
  });
}

async function handleDelete(context, data) {
  const firestoreId = String(data.firestoreId || '').trim();
  const legacyLocalId = normalizeLegacyLocalId(data.legacyLocalId);

  if (firestoreId) {
    const existing = await getDocument(context.idToken, 'blog_posts/' + firestoreId);
    if (!existing.exists || !existing.document) {
      return error(404, 'not_found', 'Blog post not found', { firestoreId: firestoreId });
    }

    await deleteDocument(context.idToken, 'blog_posts/' + firestoreId);
    const changes = buildAuditChanges('delete', {
      title: data.title || (existing.document.data || {}).title || '',
      legacyLocalId: legacyLocalId,
      note: 'Deleted canonical blog post'
    });
    await persistAuditEntry(context, 'delete', firestoreId, changes);

    return json({
      ok: true,
      action: 'delete',
      firestoreId: firestoreId,
      legacyLocalId: legacyLocalId,
      deletedCanonical: true,
      reviewedBy: context.identity.email,
      changes: changes
    });
  }

  if (!legacyLocalId) {
    return error(400, 'invalid_payload', 'Delete requires a canonical Firestore id or a legacy local id');
  }

  const changes = buildAuditChanges('delete', {
    title: data.title,
    legacyLocalId: legacyLocalId,
    note: 'Removed legacy local-only blog post reference'
  });
  await persistAuditEntry(context, 'delete', '', changes);

  return json({
    ok: true,
    action: 'delete',
    firestoreId: '',
    legacyLocalId: legacyLocalId,
    legacyOnly: true,
    reviewedBy: context.identity.email,
    changes: changes
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

  const parsed = requestSchema.safeParse(payload || {});
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

  try {
    if (parsed.data.action === 'save') {
      return await handleSave(context, parsed.data);
    }
    return await handleDelete(context, parsed.data);
  } catch (writeError) {
    log('error', {
      code: 'blog_editor_failed',
      action: parsed.data.action,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return errorFromException(writeError);
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
