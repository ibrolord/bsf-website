import { z } from 'zod';

import { requirePermission } from '../_lib/auth.js';
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
const CATEGORY_VALUES = ['story', 'update', 'insight', 'guide'];
const submitSchema = z.object({
  title: z.string().trim().min(3).max(180),
  category: z.enum(CATEGORY_VALUES),
  author: z.string().trim().min(2).max(120),
  excerpt: z.string().trim().min(12).max(400),
  coverImage: z.string().trim().max(2000).optional().default(''),
  coverImageAlt: z.string().trim().max(300).optional().default(''),
  body: z.string().trim().min(80).max(40000)
});

function errorFromException(exception) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || 'request_failed', exception.message, exception.details);
  }
  return error(500, 'internal_error', 'Blog submission failed');
}

function estimateReadTime(body) {
  const words = String(body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function buildPostPayload(data, email) {
  const coverImage = String(data.coverImage || '').trim();
  const title = String(data.title || '').trim();

  return {
    title: title,
    category: data.category,
    author: String(data.author || '').trim(),
    date: new Date().toISOString().split('T')[0],
    excerpt: String(data.excerpt || '').trim(),
    coverImage: coverImage,
    coverImageAlt: coverImage ? (String(data.coverImageAlt || '').trim() || title) : '',
    body: String(data.body || '').trim(),
    readTime: estimateReadTime(data.body),
    status: 'pending',
    aiGenerated: false,
    submittedBy: email,
    submittedAt: new Date()
  };
}

async function writeAuditEntry(context, firestoreId, title) {
  try {
    await createDocument(context.idToken, 'audit_log', {
      action: 'create',
      collection: 'blog_posts',
      documentId: firestoreId,
      changes: 'Submitted blog post for review: ' + title,
      userId: context.identity.uid,
      userEmail: context.identity.email,
      timestamp: new Date(),
      context: {
        route: 'api/blog/submit',
        permission: context.permission
      }
    });
  } catch (_auditError) {
    // The post itself is more important than the audit trail here.
  }
}

export async function POST(request) {
  let context;
  try {
    context = await requirePermission(request, 'blog.create');
  } catch (authError) {
    return errorFromException(authError);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const parsed = submitSchema.safeParse(payload || {});
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
    const post = buildPostPayload(parsed.data, context.identity.email);
    const created = await createDocument(context.idToken, 'blog_posts', post);
    await writeAuditEntry(context, created.id, post.title);

    return json({
      ok: true,
      firestoreId: created.id,
      status: post.status,
      submittedBy: context.identity.email
    }, {
      status: 201
    });
  } catch (writeError) {
    return errorFromException(writeError);
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
