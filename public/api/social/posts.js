// ═══════════════════════════════════════════════════════════════
//  /api/social/posts — persistence for Social Studio drafts
//
//  One Firestore doc per platform-post in `social_posts`. Posts that
//  target several platforms share a `groupId`. Mirrors the conventions
//  of admin/mutate.js + admin/blog/review.js (POST(request) + node
//  adapter, requireAnyPermission, zod, firestore-rest, audit_log).
//
//  Actions:
//    social.save         create/update one post   (create: social.create | update: social.edit)
//    social.save_group   create many at once       (social.create)
//    social.review       approve | reject one      (social.approve)
//    social.schedule     set/clear scheduledFor    (social.edit)
//    social.mark_posted  mark posted / un-post      (social.edit)
//    social.delete       delete one post or a group (social.delete)
//
//  Security: `save` can only ever leave a post in `draft`. Moving to
//  `approved`/`posted` requires the dedicated review/mark actions and
//  their stricter permissions — a social.edit holder cannot self-approve.
//
//  createSocialPost() is exported for the cron auto-drafter (Block F).
// ═══════════════════════════════════════════════════════════════

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { requireAnyPermission } from '../_lib/auth.js';
import { createDocument, deleteDocument, getDocument, patchDocument, queryCollectionByField } from '../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  nodeRequestUrl,
  sendNodeResponse
} from '../_lib/response.js';
import { CARD_FORMATS, CARD_TEMPLATES, defaultFormatFor, enforcePlatformLimits } from '../_lib/brand.js';

const ALLOWED_METHODS = ['POST'];
const ROUTE = 'api/social/posts';
const COLLECTION = 'social_posts';
const VALID_STATUS = new Set(['draft', 'approved', 'rejected', 'posted']);
const THEME_KEYS = ['green', 'terracotta', 'brown', 'cream'];

// ── Schemas ──
const cardSchema = z.object({
  template: z.enum(Object.keys(CARD_TEMPLATES)).optional().default('quote'),
  format: z.enum(Object.keys(CARD_FORMATS)).optional().default('feed-square'),
  theme: z.enum(THEME_KEYS).optional().default('green'),
  eyebrow: z.string().trim().max(60).optional().default(''),
  headline: z.string().trim().max(300).optional().default(''),
  subtext: z.string().trim().max(220).optional().default('')
});

const sourceSchema = z.object({
  type: z.enum(['topic', 'blog', 'event', 'story', 'manual']).optional().default('manual'),
  title: z.string().trim().max(300).optional().default(''),
  refId: z.string().trim().max(200).optional().default('')
});

const postBody = {
  platform: z.enum(['instagram', 'facebook', 'twitter']),
  caption: z.string().trim().max(6000).optional().default(''),
  hashtags: z.array(z.string().trim().max(120)).max(40).optional().default([]),
  card: cardSchema.optional(),
  source: sourceSchema.optional(),
  scheduledFor: z.string().trim().max(40).optional().default(''),
  aiGenerated: z.boolean().optional().default(false),
  aiModel: z.string().trim().max(80).optional().default('')
};

const schemas = {
  'social.save': z.object({ action: z.literal('social.save'), id: z.string().trim().max(200).optional().default(''), groupId: z.string().trim().max(200).optional().default(''), ...postBody }),
  'social.save_group': z.object({
    action: z.literal('social.save_group'),
    scheduledFor: z.string().trim().max(40).optional().default(''),
    source: sourceSchema.optional(),
    posts: z.array(z.object(postBody)).min(1).max(3)
  }),
  'social.review': z.object({ action: z.literal('social.review'), id: z.string().trim().min(1).max(200), decision: z.enum(['approved', 'rejected']), rejectionReason: z.string().trim().max(2000).optional().default('') }),
  'social.schedule': z.object({ action: z.literal('social.schedule'), id: z.string().trim().min(1).max(200), scheduledFor: z.string().trim().max(40).optional().default('') }),
  'social.mark_posted': z.object({ action: z.literal('social.mark_posted'), id: z.string().trim().min(1).max(200), posted: z.boolean() }),
  'social.delete': z.object({ action: z.literal('social.delete'), id: z.string().trim().max(200).optional().default(''), groupId: z.string().trim().max(200).optional().default('') })
};

// ── Helpers ──
function log(level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: 'social-posts' }, payload)));
}

function errorFromException(exception, fallbackCode, fallbackMessage) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || fallbackCode || 'request_failed', exception.message, exception.details);
  }
  return error(500, fallbackCode || 'internal_error', fallbackMessage || 'Request failed');
}

function parseScheduledFor(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw error(400, 'invalid_schedule', 'scheduledFor must be a valid date/time (YYYY-MM-DD or ISO)');
  }
  return parsed;
}

function normalizeCard(card, platform) {
  const safe = card && typeof card === 'object' ? card : {};
  return {
    template: CARD_TEMPLATES[safe.template] ? safe.template : 'quote',
    format: CARD_FORMATS[safe.format] ? safe.format : defaultFormatFor(platform),
    theme: THEME_KEYS.includes(safe.theme) ? safe.theme : 'green',
    eyebrow: String(safe.eyebrow || '').slice(0, 60),
    headline: String(safe.headline || '').slice(0, 300),
    subtext: String(safe.subtext || '').slice(0, 220)
  };
}

function normalizeSource(source) {
  const safe = source && typeof source === 'object' ? source : {};
  const type = ['topic', 'blog', 'event', 'story', 'manual'].includes(safe.type) ? safe.type : 'manual';
  return { type, title: String(safe.title || '').slice(0, 300), refId: String(safe.refId || '').slice(0, 200) };
}

// Builds a brand-new draft document. Always starts in `draft` status.
function buildCreateData(input, actorEmail, groupId, sharedSchedule) {
  const now = new Date();
  const card = normalizeCard(input.card, input.platform);
  const limited = enforcePlatformLimits(input.platform, input.caption, input.hashtags);
  return {
    groupId: groupId || randomUUID(),
    platform: input.platform,
    format: card.format,
    status: 'draft',
    caption: limited.caption,
    hashtags: limited.hashtags,
    card,
    source: normalizeSource(input.source),
    scheduledFor: parseScheduledFor(input.scheduledFor || sharedSchedule || ''),
    aiGenerated: Boolean(input.aiGenerated),
    aiModel: String(input.aiModel || ''),
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
    approvedBy: '',
    approvedAt: null,
    rejectedBy: '',
    rejectedAt: null,
    rejectionReason: '',
    postedBy: '',
    postedAt: null
  };
}

async function writeAudit(context, details) {
  await createDocument(context.idToken, 'audit_log', {
    action: details.action,
    collection: COLLECTION,
    documentId: details.documentId || '',
    changes: details.changes || '',
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: ROUTE,
      adminAction: details.adminAction || '',
      permission: details.permission || context.permission || '',
      automation: Boolean(context.isAutomation),
      automationName: context.automationName || ''
    }
  });
}

// ── Core create (reused by the cron auto-drafter) ──
export async function createSocialPost(context, input, groupId, sharedSchedule) {
  const data = buildCreateData(input, context.identity.email, groupId, sharedSchedule);
  const created = await createDocument(context.idToken, COLLECTION, data);
  await writeAudit(context, { adminAction: 'social.save', action: 'create', documentId: created.id, changes: 'Created ' + input.platform + ' draft' });
  return { id: created.id, groupId: data.groupId, platform: input.platform };
}

// ── Action handlers ──
async function handleSave(request, data) {
  const isUpdate = Boolean(String(data.id || '').trim());
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['social.edit'] : ['social.create']);
  } catch (authError) {
    return errorFromException(authError, 'social_save_failed', 'Save failed');
  }

  if (!isUpdate) {
    try {
      const created = await createSocialPost(context, data, String(data.groupId || '').trim() || undefined);
      return json({ ok: true, action: 'social.save', mode: 'create', id: created.id, groupId: created.groupId, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      if (createError && createError.status) return createError; // e.g. invalid_schedule
      log('error', { code: 'social_create_failed', actor: context.identity.email, message: createError.message });
      return error(500, 'social_create_failed', 'Unable to create the post');
    }
  }

  // ── Update: only mutable content fields. Status + approval are untouched. ──
  let existing;
  try {
    existing = await getDocument(context.idToken, COLLECTION + '/' + data.id);
  } catch (_readError) {
    return error(500, 'social_read_failed', 'Unable to load the post');
  }
  if (!existing.exists || !existing.document) {
    return error(404, 'not_found', 'Post not found', { id: data.id });
  }

  const card = normalizeCard(data.card, data.platform);
  let scheduledFor;
  try {
    scheduledFor = parseScheduledFor(data.scheduledFor);
  } catch (scheduleError) {
    return scheduleError;
  }
  const limited = enforcePlatformLimits(data.platform, data.caption, data.hashtags);
  // Editing content sends the post back to draft for re-review and clears any
  // prior approval/posted metadata — changed content can never keep old approval.
  const patch = {
    platform: data.platform,
    format: card.format,
    caption: limited.caption,
    hashtags: limited.hashtags,
    card,
    source: normalizeSource(data.source),
    scheduledFor,
    aiModel: String(data.aiModel || existing.document.data.aiModel || ''),
    status: 'draft',
    approvedBy: '',
    approvedAt: null,
    rejectedBy: '',
    rejectedAt: null,
    rejectionReason: '',
    postedBy: '',
    postedAt: null,
    updatedBy: context.identity.email,
    updatedAt: new Date()
  };

  try {
    await patchDocument(context.idToken, COLLECTION + '/' + data.id, patch, Object.keys(patch));
    await writeAudit(context, { adminAction: 'social.save', action: 'update', documentId: data.id, changes: 'Edited ' + data.platform + ' post' });
    return json({ ok: true, action: 'social.save', mode: 'update', id: data.id, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('error', { code: 'social_update_failed', id: data.id, actor: context.identity.email, message: writeError.message });
    return error(500, 'social_update_failed', 'Unable to update the post', { id: data.id });
  }
}

async function handleSaveGroup(request, data) {
  let context;
  try {
    context = await requireAnyPermission(request, ['social.create']);
  } catch (authError) {
    return errorFromException(authError, 'social_save_group_failed', 'Save failed');
  }

  const groupId = randomUUID();
  try {
    const created = [];
    for (const post of data.posts) {
      const merged = Object.assign({}, post, { source: post.source || data.source });
      const result = await createSocialPost(context, merged, groupId, data.scheduledFor);
      created.push(result);
    }
    return json({ ok: true, action: 'social.save_group', groupId: groupId, created: created, count: created.length, automation: Boolean(context.isAutomation) });
  } catch (createError) {
    if (createError && createError.status) return createError;
    log('error', { code: 'social_save_group_failed', actor: context.identity.email, message: createError.message });
    return error(500, 'social_save_group_failed', 'Unable to save the posts');
  }
}

async function handleReview(request, data) {
  let context;
  try {
    context = await requireAnyPermission(request, ['social.approve']);
  } catch (authError) {
    return errorFromException(authError, 'social_review_failed', 'Review failed');
  }

  let existing;
  try {
    existing = await getDocument(context.idToken, COLLECTION + '/' + data.id);
  } catch (_readError) {
    return error(500, 'social_read_failed', 'Unable to load the post');
  }
  if (!existing.exists || !existing.document) {
    return error(404, 'not_found', 'Post not found', { id: data.id });
  }

  const previousStatus = String(existing.document.data.status || 'draft');
  const now = new Date();
  const reviewer = context.identity.email;
  const patch = data.decision === 'approved'
    ? { status: 'approved', approvedBy: reviewer, approvedAt: now, rejectedBy: '', rejectedAt: null, rejectionReason: '', updatedBy: reviewer, updatedAt: now }
    : { status: 'rejected', rejectedBy: reviewer, rejectedAt: now, rejectionReason: data.rejectionReason || '', approvedBy: '', approvedAt: null, updatedBy: reviewer, updatedAt: now };

  try {
    await patchDocument(context.idToken, COLLECTION + '/' + data.id, patch, Object.keys(patch));
    await writeAudit(context, { adminAction: 'social.review', action: 'update', documentId: data.id, changes: 'Status: ' + previousStatus + ' -> ' + data.decision + (data.decision === 'rejected' && data.rejectionReason ? '; Reason: ' + data.rejectionReason : '') });
    return json({ ok: true, action: 'social.review', id: data.id, status: data.decision, previousStatus: previousStatus, reviewedBy: reviewer });
  } catch (writeError) {
    log('error', { code: 'social_review_failed', id: data.id, actor: reviewer, message: writeError.message });
    return error(500, 'social_review_failed', 'Unable to review the post', { id: data.id });
  }
}

async function handleSchedule(request, data) {
  let context;
  try {
    context = await requireAnyPermission(request, ['social.edit']);
  } catch (authError) {
    return errorFromException(authError, 'social_schedule_failed', 'Reschedule failed');
  }

  let scheduledFor;
  try {
    scheduledFor = parseScheduledFor(data.scheduledFor);
  } catch (scheduleError) {
    return scheduleError;
  }

  let existing;
  try {
    existing = await getDocument(context.idToken, COLLECTION + '/' + data.id);
  } catch (_readError) {
    return error(500, 'social_read_failed', 'Unable to load the post');
  }
  if (!existing.exists || !existing.document) {
    return error(404, 'not_found', 'Post not found', { id: data.id });
  }

  const patch = { scheduledFor: scheduledFor, updatedBy: context.identity.email, updatedAt: new Date() };
  try {
    await patchDocument(context.idToken, COLLECTION + '/' + data.id, patch, Object.keys(patch));
    await writeAudit(context, { adminAction: 'social.schedule', action: 'update', documentId: data.id, changes: scheduledFor ? 'Scheduled for ' + scheduledFor.toISOString() : 'Schedule cleared' });
    return json({ ok: true, action: 'social.schedule', id: data.id, scheduledFor: scheduledFor ? scheduledFor.toISOString() : null });
  } catch (writeError) {
    log('error', { code: 'social_schedule_failed', id: data.id, actor: context.identity.email, message: writeError.message });
    return error(500, 'social_schedule_failed', 'Unable to reschedule the post', { id: data.id });
  }
}

async function handleMarkPosted(request, data) {
  let context;
  try {
    context = await requireAnyPermission(request, ['social.approve']);
  } catch (authError) {
    return errorFromException(authError, 'social_mark_failed', 'Update failed');
  }

  let existing;
  try {
    existing = await getDocument(context.idToken, COLLECTION + '/' + data.id);
  } catch (_readError) {
    return error(500, 'social_read_failed', 'Unable to load the post');
  }
  if (!existing.exists || !existing.document) {
    return error(404, 'not_found', 'Post not found', { id: data.id });
  }

  const currentStatus = String(existing.document.data.status || 'draft');
  if (data.posted && currentStatus !== 'approved' && currentStatus !== 'posted') {
    return error(409, 'not_approved', 'Only an approved post can be marked as posted');
  }
  const now = new Date();
  const patch = data.posted
    ? { status: 'posted', postedBy: context.identity.email, postedAt: now, updatedBy: context.identity.email, updatedAt: now }
    : { status: 'approved', postedBy: '', postedAt: null, updatedBy: context.identity.email, updatedAt: now };

  try {
    await patchDocument(context.idToken, COLLECTION + '/' + data.id, patch, Object.keys(patch));
    await writeAudit(context, { adminAction: 'social.mark_posted', action: 'update', documentId: data.id, changes: data.posted ? 'Marked posted' : 'Marked not posted' });
    return json({ ok: true, action: 'social.mark_posted', id: data.id, status: patch.status });
  } catch (writeError) {
    log('error', { code: 'social_mark_failed', id: data.id, actor: context.identity.email, message: writeError.message });
    return error(500, 'social_mark_failed', 'Unable to update the post', { id: data.id });
  }
}

async function handleDelete(request, data) {
  let context;
  try {
    context = await requireAnyPermission(request, ['social.delete']);
  } catch (authError) {
    return errorFromException(authError, 'social_delete_failed', 'Delete failed');
  }

  const id = String(data.id || '').trim();
  const groupId = String(data.groupId || '').trim();
  if (!id && !groupId) {
    return error(400, 'missing_target', 'Provide an id or groupId to delete');
  }

  try {
    if (groupId) {
      const matches = await queryCollectionByField(context.idToken, COLLECTION, 'groupId', groupId);
      await Promise.all(matches.map((doc) => deleteDocument(context.idToken, COLLECTION + '/' + doc.id)));
      await writeAudit(context, { adminAction: 'social.delete', action: 'delete', documentId: groupId, changes: 'Deleted group (' + matches.length + ' posts)' });
      return json({ ok: true, action: 'social.delete', groupId: groupId, deleted: matches.length });
    }
    await deleteDocument(context.idToken, COLLECTION + '/' + id);
    await writeAudit(context, { adminAction: 'social.delete', action: 'delete', documentId: id, changes: 'Deleted post' });
    return json({ ok: true, action: 'social.delete', id: id, deleted: 1 });
  } catch (writeError) {
    log('error', { code: 'social_delete_failed', actor: context.identity.email, message: writeError.message });
    return error(500, 'social_delete_failed', 'Unable to delete', { id: id || null, groupId: groupId || null });
  }
}

const HANDLERS = {
  'social.save': handleSave,
  'social.save_group': handleSaveGroup,
  'social.review': handleReview,
  'social.schedule': handleSchedule,
  'social.mark_posted': handleMarkPosted,
  'social.delete': handleDelete
};

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const action = payload && typeof payload.action === 'string' ? payload.action.trim() : '';
  if (!action || !schemas[action]) {
    return error(400, 'invalid_action', 'Unknown social action', { action: action || null, allowedActions: Object.keys(schemas) });
  }

  const parsed = schemas[action].safeParse(payload || {});
  if (!parsed.success) {
    return error(400, 'invalid_payload', 'Request payload did not match the expected shape', {
      action: action,
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }

  return HANDLERS[action](request, parsed.data);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendNodeResponse(methodNotAllowed(ALLOWED_METHODS), res);
  }
  const headers = nodeHeadersToWebHeaders(req.headers);
  const body = nodeRequestBodyToString(req);
  const requestUrl = nodeRequestUrl(req, headers, 'thebigsisterfoundation.org');
  const request = new Request(requestUrl.toString(), { method: 'POST', headers: headers, body: body });
  return sendNodeResponse(await POST(request), res);
}
