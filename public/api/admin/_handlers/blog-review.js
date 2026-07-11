import { z } from 'zod';

import { requireAnyPermission } from '../../_lib/auth.js';
import { createDocument, getDocument, patchDocument } from '../../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  nodeRequestUrl,
  sendNodeResponse
} from '../../_lib/response.js';

const ALLOWED_METHODS = ['POST'];
const PERMISSIONS = ['blog.approve', 'blog.edit_any'];
const reviewSchema = z.object({
  firestoreId: z.string().trim().min(1).max(200),
  decision: z.enum(['approved', 'rejected']),
  rejectionReason: z.string().trim().max(2000).optional().default('')
});

function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'admin-blog-review' }, payload)));
}

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Blog review failed');
}

function buildAuditChanges(previousStatus, nextStatus, rejectionReason) {
  const changes = ['Status: ' + String(previousStatus || 'pending') + ' -> ' + nextStatus];
  if (nextStatus === 'rejected' && rejectionReason) {
    changes.push('Reason: ' + rejectionReason);
  }
  return changes.join('; ');
}

async function persistAuditEntry(context, firestoreId, previousStatus, nextStatus, rejectionReason) {
  const changes = buildAuditChanges(previousStatus, nextStatus, rejectionReason);
  await createDocument(context.idToken, 'audit_log', {
    action: 'update',
    collection: 'blog_posts',
    documentId: firestoreId,
    changes: changes,
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: 'api/admin/blog/review',
      permission: context.permission
    }
  });
  return changes;
}

function buildReviewPatch(nextStatus, reviewerEmail, rejectionReason) {
  if (nextStatus === 'approved') {
    return {
      status: 'approved',
      approvedBy: reviewerEmail,
      approvedAt: new Date(),
      rejectedBy: '',
      rejectedAt: null,
      rejectionReason: ''
    };
  }

  return {
    status: 'rejected',
    rejectedBy: reviewerEmail,
    rejectedAt: new Date(),
    rejectionReason: rejectionReason || '',
    approvedBy: '',
    approvedAt: null
  };
}

export async function POST(request) {
  let context;
  try {
    context = await requireAnyPermission(request, PERMISSIONS);
  } catch (authError) {
    return errorFromException(authError);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = reviewSchema.safeParse(payload || {});
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

  const firestoreId = parsed.data.firestoreId;
  const nextStatus = parsed.data.decision;
  const rejectionReason = parsed.data.rejectionReason || '';

  let blogPost;
  try {
    blogPost = await getDocument(context.idToken, 'blog_posts/' + firestoreId);
  } catch (readError) {
    log('error', {
      code: 'blog_post_read_failed',
      firestoreId: firestoreId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'blog_post_read_failed', 'Unable to load the blog post');
  }

  if (!blogPost.exists || !blogPost.document) {
    return error(404, 'not_found', 'Blog post not found', {
      firestoreId: firestoreId
    });
  }

  const existingData = blogPost.document.data || {};
  const previousStatus = String(existingData.status || 'published');
  if (previousStatus === nextStatus) {
    return json({
      ok: true,
      firestoreId: firestoreId,
      status: nextStatus,
      previousStatus: previousStatus,
      noChange: true
    });
  }

  if (previousStatus !== 'pending') {
    return error(409, 'post_not_pending', 'Only pending posts can be reviewed', {
      firestoreId: firestoreId,
      status: previousStatus
    });
  }

  const reviewPatch = buildReviewPatch(nextStatus, context.identity.email, rejectionReason);

  try {
    await patchDocument(context.idToken, 'blog_posts/' + firestoreId, reviewPatch, Object.keys(reviewPatch));
    const changes = await persistAuditEntry(context, firestoreId, previousStatus, nextStatus, rejectionReason);

    log('log', {
      code: 'blog_post_reviewed',
      firestoreId: firestoreId,
      actor: context.identity.email,
      previousStatus: previousStatus,
      nextStatus: nextStatus,
      permission: context.permission
    });

    return json({
      ok: true,
      firestoreId: firestoreId,
      previousStatus: previousStatus,
      status: nextStatus,
      reviewedBy: context.identity.email,
      rejectionReason: nextStatus === 'rejected' ? rejectionReason : '',
      changes: changes
    });
  } catch (writeError) {
    log('error', {
      code: 'blog_post_review_failed',
      firestoreId: firestoreId,
      actor: context.identity.email,
      nextStatus: nextStatus,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'blog_post_review_failed', 'Unable to review the blog post', {
      firestoreId: firestoreId
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendNodeResponse(methodNotAllowed(ALLOWED_METHODS), res);
  }

  const headers = nodeHeadersToWebHeaders(req.headers);
  const body = nodeRequestBodyToString(req);
  const requestUrl = nodeRequestUrl(req, headers, 'thebigsisterfoundation.org');
  const request = new Request(requestUrl.toString(), {
    method: 'POST',
    headers: headers,
    body: body
  });

  return sendNodeResponse(await POST(request), res);
}
