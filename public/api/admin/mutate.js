import { z } from 'zod';

import { requireAnyPermission, requirePermission } from '../_lib/auth.js';
import { createDocument, deleteDocument, getDocument, patchDocument, queryCollectionByField } from '../_lib/firestore-rest.js';
import {
  error,
  json,
  methodNotAllowed,
  nodeHeadersToWebHeaders,
  nodeRequestBodyToString,
  sendNodeResponse
} from '../_lib/response.js';

const ALLOWED_METHODS = ['POST'];
const ROUTE = 'api/admin/mutate';

const schemas = {
  'volunteer.save': z.object({
    action: z.literal('volunteer.save'),
    volunteerId: z.string().trim().max(200).optional().default(''),
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
    phone: z.string().trim().max(80).optional().default(''),
    location: z.string().trim().max(200).optional().default(''),
    role: z.string().trim().max(120).optional().default(''),
    skills: z.array(z.string().trim().min(1).max(120)).max(50).optional().default([]),
    status: z.string().trim().min(1).max(50)
  }),
  'volunteer.delete': z.object({
    action: z.literal('volunteer.delete'),
    volunteerId: z.string().trim().min(1).max(200),
    name: z.string().trim().max(200).optional().default('')
  }),
  'school.save': z.object({
    action: z.literal('school.save'),
    schoolId: z.string().trim().max(200).optional().default(''),
    name: z.string().trim().min(1).max(200),
    location: z.string().trim().min(1).max(200),
    communityId: z.string().trim().max(200).optional().default(''),
    contactEmail: z.string().trim().max(320).optional().default('').refine(function(value) {
      return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }, 'Contact email must be a valid email address'),
    contactPhone: z.string().trim().max(80).optional().default('')
  }),
  'school.delete': z.object({
    action: z.literal('school.delete'),
    schoolId: z.string().trim().min(1).max(200),
    name: z.string().trim().max(200).optional().default('')
  }),
  'community.save': z.object({
    action: z.literal('community.save'),
    communityId: z.string().trim().max(200).optional().default(''),
    name: z.string().trim().min(1).max(200),
    location: z.string().trim().min(1).max(200),
    area: z.enum(['mainland', 'island', 'suburban']),
    description: z.string().trim().max(10000).optional().default(''),
    scholarCount: z.number().int().min(0).max(1000000),
    totalInvestment: z.number().min(0).max(1000000000000)
  }),
  'community.delete': z.object({
    action: z.literal('community.delete'),
    communityId: z.string().trim().min(1).max(200),
    name: z.string().trim().max(200).optional().default('')
  }),
  'community.seed_demo': z.object({
    action: z.literal('community.seed_demo')
  }),
  'idea.save': z.object({
    action: z.literal('idea.save'),
    ideaId: z.string().trim().max(200).optional().default(''),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    status: z.string().trim().min(1).max(80),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional().default([]),
    estimatedCost: z.number().min(0).max(1000000000000),
    authorName: z.string().trim().max(200).optional().default(''),
    votes: z.number().int().min(0).max(1000000).optional().default(0)
  }),
  'idea.delete': z.object({
    action: z.literal('idea.delete'),
    ideaId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default('')
  }),
  'forum.post.save': z.object({
    action: z.literal('forum.post.save'),
    postId: z.string().trim().max(200).optional().default(''),
    teamId: z.string().trim().max(200).optional().default(''),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
    category: z.string().trim().max(80).optional().default('General'),
    pinned: z.boolean().optional().default(false)
  }),
  'forum.post.delete': z.object({
    action: z.literal('forum.post.delete'),
    postId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default(''),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'forum.post.pin': z.object({
    action: z.literal('forum.post.pin'),
    postId: z.string().trim().min(1).max(200),
    pinned: z.boolean(),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'forum.reply.save': z.object({
    action: z.literal('forum.reply.save'),
    replyId: z.string().trim().max(200).optional().default(''),
    postId: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'forum.reply.delete': z.object({
    action: z.literal('forum.reply.delete'),
    replyId: z.string().trim().min(1).max(200),
    postId: z.string().trim().max(200).optional().default(''),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'team_forum.post.save': z.object({
    action: z.literal('team_forum.post.save'),
    postId: z.string().trim().max(200).optional().default(''),
    teamId: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000),
    pinned: z.boolean().optional().default(false)
  }),
  'team_forum.post.delete': z.object({
    action: z.literal('team_forum.post.delete'),
    postId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default(''),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'team_forum.post.pin': z.object({
    action: z.literal('team_forum.post.pin'),
    postId: z.string().trim().min(1).max(200),
    pinned: z.boolean(),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'team_forum.reply.save': z.object({
    action: z.literal('team_forum.reply.save'),
    replyId: z.string().trim().max(200).optional().default(''),
    postId: z.string().trim().min(1).max(200),
    teamId: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000)
  }),
  'team_forum.reply.delete': z.object({
    action: z.literal('team_forum.reply.delete'),
    replyId: z.string().trim().min(1).max(200),
    postId: z.string().trim().max(200).optional().default(''),
    teamId: z.string().trim().max(200).optional().default('')
  }),
  'announcement.save': z.object({
    action: z.literal('announcement.save'),
    announcementId: z.string().trim().max(200).optional().default(''),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    type: z.string().trim().min(1).max(50),
    audience: z.string().trim().min(1).max(50),
    active: z.boolean(),
    expiresAt: z.string().trim().optional().default('')
  }),
  'announcement.toggle': z.object({
    action: z.literal('announcement.toggle'),
    announcementId: z.string().trim().min(1).max(200),
    active: z.boolean()
  }),
  'announcement.delete': z.object({
    action: z.literal('announcement.delete'),
    announcementId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default('')
  }),
  'event.save': z.object({
    action: z.literal('event.save'),
    eventId: z.string().trim().max(200).optional().default(''),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000).optional().default(''),
    date: z.string().trim().min(1),
    endDate: z.string().trim().optional().default(''),
    location: z.string().trim().max(200).optional().default(''),
    type: z.string().trim().min(1).max(50),
    status: z.string().trim().min(1).max(50),
    owner: z.string().trim().min(1).max(320),
    collaborators: z.array(z.string().trim().min(1).max(320)).max(50).optional().default([]),
    capacity: z.union([z.number().int().min(0).max(1000000), z.null()]).optional().default(null)
  }),
  'event.delete': z.object({
    action: z.literal('event.delete'),
    eventId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default('')
  }),
  'ledger.save': z.object({
    action: z.literal('ledger.save'),
    ledgerId: z.string().trim().max(200).optional().default(''),
    date: z.string().trim().min(1),
    description: z.string().trim().min(1).max(500),
    category: z.string().trim().min(1).max(120),
    amount: z.number().min(0).max(1000000000),
    direction: z.enum(['in', 'out']),
    program: z.string().trim().max(200).optional().default(''),
    sourceName: z.string().trim().max(200).optional().default(''),
    notes: z.string().trim().max(5000).optional().default('')
  }),
  'ledger.delete': z.object({
    action: z.literal('ledger.delete'),
    ledgerId: z.string().trim().min(1).max(200)
  }),
  'volunteer.bulk_status': z.object({
    action: z.literal('volunteer.bulk_status'),
    volunteerIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
    status: z.string().trim().min(1).max(50)
  }),
  'bulk.delete': z.object({
    action: z.literal('bulk.delete'),
    collection: z.enum(['volunteers', 'schools', 'ledger', 'goals', 'outreach', 'communities', 'ideas']),
    ids: z.array(z.string().trim().min(1).max(200)).min(1).max(100)
  }),
  'event.signup': z.object({
    action: z.literal('event.signup'),
    eventId: z.string().trim().min(1).max(200)
  }),
  'goal.save': z.object({
    action: z.literal('goal.save'),
    goalId: z.string().trim().max(200).optional().default(''),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000).optional().default(''),
    targetValue: z.number().min(0).max(1000000000),
    currentValue: z.number().min(0).max(1000000000),
    unit: z.string().trim().max(120).optional().default(''),
    deadline: z.string().trim().optional().default(''),
    category: z.string().trim().min(1).max(80),
    status: z.string().trim().min(1).max(80),
    assignee: z.string().trim().max(320).optional().default('')
  }),
  'goal.delete': z.object({
    action: z.literal('goal.delete'),
    goalId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default('')
  }),
  'goal.progress': z.object({
    action: z.literal('goal.progress'),
    goalId: z.string().trim().min(1).max(200),
    currentValue: z.number().min(0).max(1000000000),
    note: z.string().trim().max(500).optional().default('')
  }),
  'outreach.save': z.object({
    action: z.literal('outreach.save'),
    outreachId: z.string().trim().max(200).optional().default(''),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000).optional().default(''),
    date: z.string().trim().optional().default(''),
    location: z.string().trim().max(200).optional().default(''),
    type: z.string().trim().min(1).max(80),
    targetAudience: z.string().trim().max(200).optional().default(''),
    attendees: z.union([z.number().int().min(0).max(1000000), z.null()]).optional().default(null),
    outcome: z.string().trim().max(5000).optional().default(''),
    status: z.string().trim().min(1).max(80),
    linkedEvent: z.string().trim().max(200).optional().default(''),
    photos: z.array(z.string().trim().min(1).max(2000)).max(50).optional().default([])
  }),
  'outreach.delete': z.object({
    action: z.literal('outreach.delete'),
    outreachId: z.string().trim().min(1).max(200),
    title: z.string().trim().max(200).optional().default('')
  }),
  'team.save': z.object({
    action: z.literal('team.save'),
    teamId: z.string().trim().max(200).optional().default(''),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional().default(''),
    focusArea: z.string().trim().min(1).max(80),
    meetingSchedule: z.string().trim().max(200).optional().default(''),
    leadId: z.string().trim().min(1).max(200),
    status: z.string().trim().min(1).max(80)
  }),
  'team.archive': z.object({
    action: z.literal('team.archive'),
    teamId: z.string().trim().min(1).max(200),
    name: z.string().trim().max(200).optional().default('')
  }),
  'team.delete': z.object({
    action: z.literal('team.delete'),
    teamId: z.string().trim().min(1).max(200),
    name: z.string().trim().max(200).optional().default('')
  }),
  'team.member.add': z.object({
    action: z.literal('team.member.add'),
    teamId: z.string().trim().min(1).max(200),
    volunteerId: z.string().trim().min(1).max(200)
  }),
  'team.member.remove': z.object({
    action: z.literal('team.member.remove'),
    teamId: z.string().trim().min(1).max(200),
    volunteerId: z.string().trim().min(1).max(200)
  }),
  'settings.save_all': z.object({
    action: z.literal('settings.save_all'),
    entries: z.array(z.object({
      key: z.string().trim().min(1).max(120),
      value: z.string().trim().max(5000).optional().default('')
    })).min(1).max(100)
  }),
  'user.permissions.save': z.object({
    action: z.literal('user.permissions.save'),
    email: z.string().trim().email().max(320),
    roles: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
    permissionOverrides: z.record(z.string().trim().min(1).max(200), z.boolean()).optional().default({}),
    permissions: z.array(z.string().trim().min(1).max(200)).max(500).optional().default([]),
    status: z.string().trim().max(80).optional().default('')
  }),
  'user.delete': z.object({
    action: z.literal('user.delete'),
    email: z.string().trim().email().max(320)
  })

};

function log(area, level, payload) {
  const logger = console[level] || console.log;
  logger(JSON.stringify(Object.assign({ area: area }, payload)));
}

function errorFromException(exception, fallbackCode, fallbackMessage) {
  if (exception && exception.status) {
    return error(exception.status, exception.code || fallbackCode || 'request_failed', exception.message, exception.details);
  }
  return error(500, fallbackCode || 'internal_error', fallbackMessage || 'Request failed');
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

function diffFields(previousData, nextData, ignoredFields) {
  const ignore = new Set(ignoredFields || []);
  return Object.keys(nextData).filter(function(key) {
    return !ignore.has(key) && !valuesEqual(previousData ? previousData[key] : undefined, nextData[key]);
  });
}

function parseOptionalDateTime(value, code, label) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw error(400, code, label + ' must be a valid date/time');
  }
  return parsed;
}

function parseRequiredDateTime(value, code, label) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    throw error(400, code, label + ' is required');
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw error(400, code, label + ' must be a valid date/time');
  }
  return parsed;
}


function parseOptionalDate(value, code, label) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw error(400, code, label + ' must be in YYYY-MM-DD format');
  }
  return trimmed;
}

function parseRequiredDate(value, code, label) {
  const trimmed = parseOptionalDate(value, code, label);
  if (!trimmed) {
    throw error(400, code, label + ' is required');
  }
  return trimmed;
}

function buildTeamMember(volunteerDocument) {
  const volunteer = volunteerDocument && volunteerDocument.data ? volunteerDocument.data : volunteerDocument || {};
  return {
    id: String(volunteerDocument && volunteerDocument.id ? volunteerDocument.id : volunteer._id || '').trim(),
    name: String(volunteer.name || '').trim(),
    email: String(volunteer.email || '').trim().toLowerCase(),
    joinedAt: new Date().toISOString()
  };
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map(function(value) {
    return String(value || '').trim();
  }).filter(Boolean)));
}

function defaultAuthorName(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return 'Admin';
  }
  return normalized.split('@')[0] || 'Admin';
}

async function deleteDocumentsByField(idToken, collectionId, fieldPath, value) {
  const matches = await queryCollectionByField(idToken, collectionId, fieldPath, value);
  await Promise.all(matches.map(function(document) {
    return deleteDocument(idToken, collectionId + '/' + document.id);
  }));
  return matches.length;
}

const DEMO_COMMUNITIES = [
  {
    name: 'Makoko Community',
    location: 'Yaba, Lagos Mainland',
    area: 'mainland',
    description: 'One of Lagos\' most resilient waterside communities. BSF supports children here with education, food security, and vocational training for older youth. Makoko is where our work began.',
    scholarCount: 28,
    totalInvestment: 4200000
  },
  {
    name: 'Ajegunle Community',
    location: 'Ajeromi-Ifelodun, Lagos Mainland',
    area: 'mainland',
    description: 'A densely populated community with incredible potential. BSF focuses on education access, after-school programs, and skills training for out-of-school youth.',
    scholarCount: 22,
    totalInvestment: 3100000
  },
  {
    name: 'Iwaya Community',
    location: 'Yaba, Lagos Mainland',
    area: 'mainland',
    description: 'Neighboring Makoko, Iwaya faces similar challenges but with a growing creative energy. BSF supports education and connects youth with mentors in tech and the arts.',
    scholarCount: 14,
    totalInvestment: 1900000
  },
  {
    name: 'Ajah/Sangotedo Community',
    location: 'Eti-Osa, Lagos Island',
    area: 'island',
    description: 'A rapidly growing suburban area where many families have relocated from inner Lagos. BSF supports the peri-urban schools and runs weekend programs for children of market traders.',
    scholarCount: 11,
    totalInvestment: 1500000
  },
  {
    name: 'Ikorodu Community',
    location: 'Ikorodu, Lagos Suburban',
    area: 'suburban',
    description: 'A historic town on the outskirts of Lagos with deep cultural roots. BSF works with local artisans to create apprenticeship pipelines for young people who have dropped out of formal education.',
    scholarCount: 9,
    totalInvestment: 1100000
  }
];

async function writeAudit(context, details) {
  await createDocument(context.idToken, 'audit_log', {
    action: details.action,
    collection: details.collection,
    documentId: details.documentId,
    changes: details.changes,
    userId: context.identity.uid,
    userEmail: context.identity.email,
    timestamp: new Date(),
    context: {
      route: ROUTE,
      adminAction: details.adminAction,
      permission: details.permission || context.permission || '',
      automation: Boolean(context.isAutomation),
      automationName: context.automationName || ''
    }
  });
}

function validatePayload(payload) {
  const action = payload && typeof payload.action === 'string' ? payload.action.trim() : '';
  if (!action || !schemas[action]) {
    return {
      success: false,
      response: error(400, 'invalid_action', 'Unknown admin action', {
        action: action || null,
        allowedActions: Object.keys(schemas)
      })
    };
  }

  const parsed = schemas[action].safeParse(payload || {});
  if (!parsed.success) {
    return {
      success: false,
      response: error(400, 'invalid_payload', 'Request payload did not match the expected shape', {
        action: action,
        issues: parsed.error.issues.map(function(issue) {
          return {
            path: issue.path.join('.'),
            message: issue.message
          };
        })
      })
    };
  }

  return {
    success: true,
    action: action,
    data: parsed.data
  };
}

async function handleVolunteerSave(request, data) {
  const volunteerId = String(data.volunteerId || '').trim();
  const isUpdate = Boolean(volunteerId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['volunteers.edit'] : ['volunteers.create']);
  } catch (authError) {
    return errorFromException(authError, 'volunteer_save_failed', 'Volunteer save failed');
  }

  const volunteerData = {
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    location: data.location,
    role: data.role,
    skills: data.skills,
    status: data.status,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'volunteers', Object.assign({}, volunteerData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'volunteer.save',
        action: 'create',
        collection: 'volunteers',
        documentId: created.id,
        changes: 'Created: ' + data.name
      });
      log('admin-mutate-volunteer-save', 'log', {
        code: 'volunteer_created',
        volunteerId: created.id,
        actor: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
      return json({ ok: true, action: 'volunteer.save', mode: 'create', volunteerId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      log('admin-mutate-volunteer-save', 'error', {
        code: 'volunteer_create_failed',
        actor: context.identity.email,
        status: createError.status || 500,
        message: createError.message,
        body: createError.body || ''
      });
      return error(500, 'volunteer_create_failed', 'Unable to create the volunteer record');
    }
  }

  let volunteerDocument;
  try {
    volunteerDocument = await getDocument(context.idToken, 'volunteers/' + volunteerId);
  } catch (readError) {
    log('admin-mutate-volunteer-save', 'error', {
      code: 'volunteer_read_failed',
      volunteerId: volunteerId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'volunteer_read_failed', 'Unable to load the volunteer record');
  }

  if (!volunteerDocument.exists || !volunteerDocument.document) {
    return error(404, 'not_found', 'Volunteer not found', { volunteerId: volunteerId });
  }

  const changedFields = diffFields(volunteerDocument.document.data || {}, volunteerData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'volunteers/' + volunteerId, volunteerData, Object.keys(volunteerData));
    await writeAudit(context, {
      adminAction: 'volunteer.save',
      action: 'update',
      collection: 'volunteers',
      documentId: volunteerId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    log('admin-mutate-volunteer-save', 'log', {
      code: 'volunteer_updated',
      volunteerId: volunteerId,
      actor: context.identity.email,
      changedFields: changedFields,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'volunteer.save', mode: 'update', volunteerId: volunteerId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-volunteer-save', 'error', {
      code: 'volunteer_update_failed',
      volunteerId: volunteerId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'volunteer_update_failed', 'Unable to update the volunteer record', { volunteerId: volunteerId });
  }
}

async function handleVolunteerDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'volunteers.delete');
  } catch (authError) {
    return errorFromException(authError, 'volunteer_delete_failed', 'Volunteer delete failed');
  }

  let volunteerDocument;
  try {
    volunteerDocument = await getDocument(context.idToken, 'volunteers/' + data.volunteerId);
  } catch (readError) {
    log('admin-mutate-volunteer-delete', 'error', {
      code: 'volunteer_read_failed',
      volunteerId: data.volunteerId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'volunteer_read_failed', 'Unable to load the volunteer record');
  }

  if (!volunteerDocument.exists || !volunteerDocument.document) {
    return error(404, 'not_found', 'Volunteer not found', { volunteerId: data.volunteerId });
  }

  const volunteerName = String((volunteerDocument.document.data || {}).name || data.name || data.volunteerId);
  try {
    await deleteDocument(context.idToken, 'volunteers/' + data.volunteerId);
    await writeAudit(context, {
      adminAction: 'volunteer.delete',
      action: 'delete',
      collection: 'volunteers',
      documentId: data.volunteerId,
      changes: 'Deleted: ' + volunteerName
    });
    log('admin-mutate-volunteer-delete', 'log', {
      code: 'volunteer_deleted',
      volunteerId: data.volunteerId,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'volunteer.delete', volunteerId: data.volunteerId, deletedName: volunteerName, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-volunteer-delete', 'error', {
      code: 'volunteer_delete_failed',
      volunteerId: data.volunteerId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'volunteer_delete_failed', 'Unable to delete the volunteer record', { volunteerId: data.volunteerId });
  }
}

async function handleSchoolSave(request, data) {
  const schoolId = String(data.schoolId || '').trim();
  const isUpdate = Boolean(schoolId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['schools.edit'] : ['schools.create']);
  } catch (authError) {
    return errorFromException(authError, 'school_save_failed', 'School save failed');
  }

  const schoolData = {
    name: data.name,
    location: data.location,
    communityId: data.communityId,
    contactEmail: data.contactEmail.toLowerCase(),
    contactPhone: data.contactPhone,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'schools', Object.assign({}, schoolData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'school.save',
        action: 'create',
        collection: 'schools',
        documentId: created.id,
        changes: 'Created: ' + data.name
      });
      log('admin-mutate-school-save', 'log', {
        code: 'school_created',
        schoolId: created.id,
        actor: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
      return json({ ok: true, action: 'school.save', mode: 'create', schoolId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      log('admin-mutate-school-save', 'error', {
        code: 'school_create_failed',
        actor: context.identity.email,
        status: createError.status || 500,
        message: createError.message,
        body: createError.body || ''
      });
      return error(500, 'school_create_failed', 'Unable to create the school record');
    }
  }

  let schoolDocument;
  try {
    schoolDocument = await getDocument(context.idToken, 'schools/' + schoolId);
  } catch (readError) {
    log('admin-mutate-school-save', 'error', {
      code: 'school_read_failed',
      schoolId: schoolId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'school_read_failed', 'Unable to load the school record');
  }

  if (!schoolDocument.exists || !schoolDocument.document) {
    return error(404, 'not_found', 'School not found', { schoolId: schoolId });
  }

  const changedFields = diffFields(schoolDocument.document.data || {}, schoolData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'schools/' + schoolId, schoolData, Object.keys(schoolData));
    await writeAudit(context, {
      adminAction: 'school.save',
      action: 'update',
      collection: 'schools',
      documentId: schoolId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    log('admin-mutate-school-save', 'log', {
      code: 'school_updated',
      schoolId: schoolId,
      actor: context.identity.email,
      changedFields: changedFields,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'school.save', mode: 'update', schoolId: schoolId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-school-save', 'error', {
      code: 'school_update_failed',
      schoolId: schoolId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'school_update_failed', 'Unable to update the school record', { schoolId: schoolId });
  }
}

async function handleSchoolDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'schools.delete');
  } catch (authError) {
    return errorFromException(authError, 'school_delete_failed', 'School delete failed');
  }

  let schoolDocument;
  try {
    schoolDocument = await getDocument(context.idToken, 'schools/' + data.schoolId);
  } catch (readError) {
    log('admin-mutate-school-delete', 'error', {
      code: 'school_read_failed',
      schoolId: data.schoolId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'school_read_failed', 'Unable to load the school record');
  }

  if (!schoolDocument.exists || !schoolDocument.document) {
    return error(404, 'not_found', 'School not found', { schoolId: data.schoolId });
  }

  const schoolName = String((schoolDocument.document.data || {}).name || data.name || data.schoolId);
  try {
    await deleteDocument(context.idToken, 'schools/' + data.schoolId);
    await writeAudit(context, {
      adminAction: 'school.delete',
      action: 'delete',
      collection: 'schools',
      documentId: data.schoolId,
      changes: 'Deleted: ' + schoolName
    });
    log('admin-mutate-school-delete', 'log', {
      code: 'school_deleted',
      schoolId: data.schoolId,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'school.delete', schoolId: data.schoolId, deletedName: schoolName, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-school-delete', 'error', {
      code: 'school_delete_failed',
      schoolId: data.schoolId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'school_delete_failed', 'Unable to delete the school record', { schoolId: data.schoolId });
  }
}

async function handleCommunitySave(request, data) {
  const communityId = String(data.communityId || '').trim();
  const isUpdate = Boolean(communityId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['communities.edit'] : ['communities.create']);
  } catch (authError) {
    return errorFromException(authError, 'community_save_failed', 'Community save failed');
  }

  const communityData = {
    name: data.name,
    location: data.location,
    area: data.area,
    description: data.description,
    scholarCount: data.scholarCount,
    totalInvestment: data.totalInvestment,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'communities', Object.assign({}, communityData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'community.save',
        action: 'create',
        collection: 'communities',
        documentId: created.id,
        changes: 'Created: ' + data.name
      });
      log('admin-mutate-community-save', 'log', {
        code: 'community_created',
        communityId: created.id,
        actor: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
      return json({ ok: true, action: 'community.save', mode: 'create', communityId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      log('admin-mutate-community-save', 'error', {
        code: 'community_create_failed',
        actor: context.identity.email,
        status: createError.status || 500,
        message: createError.message,
        body: createError.body || ''
      });
      return error(500, 'community_create_failed', 'Unable to create the community record');
    }
  }

  let communityDocument;
  try {
    communityDocument = await getDocument(context.idToken, 'communities/' + communityId);
  } catch (readError) {
    log('admin-mutate-community-save', 'error', {
      code: 'community_read_failed',
      communityId: communityId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'community_read_failed', 'Unable to load the community record');
  }

  if (!communityDocument.exists || !communityDocument.document) {
    return error(404, 'not_found', 'Community not found', { communityId: communityId });
  }

  const changedFields = diffFields(communityDocument.document.data || {}, communityData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'communities/' + communityId, communityData, Object.keys(communityData));
    await writeAudit(context, {
      adminAction: 'community.save',
      action: 'update',
      collection: 'communities',
      documentId: communityId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    log('admin-mutate-community-save', 'log', {
      code: 'community_updated',
      communityId: communityId,
      actor: context.identity.email,
      changedFields: changedFields,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'community.save', mode: 'update', communityId: communityId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-community-save', 'error', {
      code: 'community_update_failed',
      communityId: communityId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'community_update_failed', 'Unable to update the community record', { communityId: communityId });
  }
}

async function handleCommunityDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'communities.delete');
  } catch (authError) {
    return errorFromException(authError, 'community_delete_failed', 'Community delete failed');
  }

  let communityDocument;
  try {
    communityDocument = await getDocument(context.idToken, 'communities/' + data.communityId);
  } catch (readError) {
    log('admin-mutate-community-delete', 'error', {
      code: 'community_read_failed',
      communityId: data.communityId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'community_read_failed', 'Unable to load the community record');
  }

  if (!communityDocument.exists || !communityDocument.document) {
    return error(404, 'not_found', 'Community not found', { communityId: data.communityId });
  }

  const communityName = String((communityDocument.document.data || {}).name || data.name || data.communityId);
  try {
    await deleteDocument(context.idToken, 'communities/' + data.communityId);
    await writeAudit(context, {
      adminAction: 'community.delete',
      action: 'delete',
      collection: 'communities',
      documentId: data.communityId,
      changes: 'Deleted: ' + communityName
    });
    log('admin-mutate-community-delete', 'log', {
      code: 'community_deleted',
      communityId: data.communityId,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'community.delete', communityId: data.communityId, deletedName: communityName, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-community-delete', 'error', {
      code: 'community_delete_failed',
      communityId: data.communityId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'community_delete_failed', 'Unable to delete the community record', { communityId: data.communityId });
  }
}

async function handleCommunitySeedDemo(request, data) {
  void data;
  let context;
  try {
    context = await requirePermission(request, 'communities.create');
  } catch (authError) {
    return errorFromException(authError, 'community_seed_demo_failed', 'Community demo seed failed');
  }

  let existingByName;
  try {
    const existingMatches = await Promise.all(DEMO_COMMUNITIES.map(function(community) {
      return queryCollectionByField(context.idToken, 'communities', 'name', community.name);
    }));
    existingByName = new Set(existingMatches.filter(Boolean).flat().map(function(document) {
      return String((document.data || {}).name || '').trim().toLowerCase();
    }).filter(Boolean));
  } catch (readError) {
    log('admin-mutate-community-seed-demo', 'error', {
      code: 'community_seed_existing_lookup_failed',
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message,
      body: readError.body || ''
    });
    return error(500, 'community_seed_existing_lookup_failed', 'Unable to inspect existing communities before seeding');
  }

  const toCreate = DEMO_COMMUNITIES.filter(function(community) {
    return !existingByName.has(String(community.name || '').trim().toLowerCase());
  });
  if (!toCreate.length) {
    return json({
      ok: true,
      action: 'community.seed_demo',
      seededCount: 0,
      existingCount: DEMO_COMMUNITIES.length,
      noChange: true,
      reviewedBy: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
  }

  try {
    const created = await Promise.all(toCreate.map(function(community) {
      return createDocument(context.idToken, 'communities', Object.assign({}, community, {
        createdAt: new Date(),
        lastEditedAt: new Date()
      }));
    }));
    await writeAudit(context, {
      adminAction: 'community.seed_demo',
      action: 'create',
      collection: 'communities',
      documentId: '',
      changes: 'Seeded ' + created.length + ' demo communities'
    });
    log('admin-mutate-community-seed-demo', 'log', {
      code: 'community_demo_seeded',
      actor: context.identity.email,
      seededCount: created.length,
      automation: Boolean(context.isAutomation)
    });
    return json({
      ok: true,
      action: 'community.seed_demo',
      seededCount: created.length,
      existingCount: DEMO_COMMUNITIES.length - created.length,
      createdIds: created.map(function(document) { return document.id; }),
      reviewedBy: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
  } catch (writeError) {
    log('admin-mutate-community-seed-demo', 'error', {
      code: 'community_seed_demo_failed',
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'community_seed_demo_failed', 'Unable to seed the demo communities');
  }
}

async function handleIdeaSave(request, data) {
  const ideaId = String(data.ideaId || '').trim();
  const isUpdate = Boolean(ideaId);
  let context;
  try {
    context = await requirePermission(request, 'ideas.edit_any');
  } catch (authError) {
    return errorFromException(authError, 'idea_save_failed', 'Idea save failed');
  }

  const ideaData = {
    title: data.title,
    description: data.description,
    status: data.status,
    tags: data.tags,
    estimatedCost: data.estimatedCost,
    authorName: data.authorName,
    votes: data.votes,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'ideas', Object.assign({}, ideaData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'idea.save',
        action: 'create',
        collection: 'ideas',
        documentId: created.id,
        changes: 'Created: ' + data.title
      });
      return json({ ok: true, action: 'idea.save', mode: 'create', ideaId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      return error(500, 'idea_create_failed', 'Unable to create the idea', { message: createError.message });
    }
  }

  let ideaDocument;
  try {
    ideaDocument = await getDocument(context.idToken, 'ideas/' + ideaId);
  } catch (readError) {
    return error(500, 'idea_read_failed', 'Unable to load the idea');
  }
  if (!ideaDocument.exists || !ideaDocument.document) {
    return error(404, 'not_found', 'Idea not found', { ideaId: ideaId });
  }

  const changedFields = diffFields(ideaDocument.document.data || {}, ideaData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'ideas/' + ideaId, ideaData, Object.keys(ideaData));
    await writeAudit(context, {
      adminAction: 'idea.save',
      action: 'update',
      collection: 'ideas',
      documentId: ideaId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    return json({ ok: true, action: 'idea.save', mode: 'update', ideaId: ideaId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, 'idea_update_failed', 'Unable to update the idea', { ideaId: ideaId, message: writeError.message });
  }
}

async function handleIdeaDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'ideas.delete_any');
  } catch (authError) {
    return errorFromException(authError, 'idea_delete_failed', 'Idea delete failed');
  }

  let ideaDocument;
  try {
    ideaDocument = await getDocument(context.idToken, 'ideas/' + data.ideaId);
  } catch (_readError) {
    return error(500, 'idea_read_failed', 'Unable to load the idea');
  }
  if (!ideaDocument.exists || !ideaDocument.document) {
    return error(404, 'not_found', 'Idea not found', { ideaId: data.ideaId });
  }

  const ideaTitle = String((ideaDocument.document.data || {}).title || data.title || data.ideaId);
  try {
    await deleteDocument(context.idToken, 'ideas/' + data.ideaId);
    await writeAudit(context, {
      adminAction: 'idea.delete',
      action: 'delete',
      collection: 'ideas',
      documentId: data.ideaId,
      changes: 'Deleted: ' + ideaTitle
    });
    return json({ ok: true, action: 'idea.delete', ideaId: data.ideaId, deletedTitle: ideaTitle, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, 'idea_delete_failed', 'Unable to delete the idea', { ideaId: data.ideaId, message: writeError.message });
  }
}

async function saveForumPostInCollection(request, config) {
  const postId = String(config.data.postId || '').trim();
  const isUpdate = Boolean(postId);
  const requestedPermissions = isUpdate ? [config.updatePermission] : [config.createPermission];
  let context;
  try {
    context = await requireAnyPermission(request, requestedPermissions);
  } catch (authError) {
    return errorFromException(authError, config.errorCode + '_failed', config.label + ' save failed');
  }

  const postData = {
    title: config.data.title,
    body: config.data.body,
    pinned: Boolean(config.data.pinned),
    authorName: defaultAuthorName(context.identity.email),
    authorEmail: context.identity.email,
    lastEditedAt: new Date()
  };
  if (config.includeCategory) {
    postData.category = config.data.category || 'General';
  }
  if (config.teamId) {
    postData.teamId = config.teamId;
  }

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, config.collection, Object.assign({}, postData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: config.auditAction,
        action: 'create',
        collection: config.collection,
        documentId: created.id,
        changes: 'Created: ' + config.data.title
      });
      return json({ ok: true, action: config.auditAction, mode: 'create', postId: created.id, collection: config.collection, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      return error(500, config.errorCode + '_create_failed', 'Unable to create the ' + config.label, { message: createError.message });
    }
  }

  let postDocument;
  try {
    postDocument = await getDocument(context.idToken, config.collection + '/' + postId);
  } catch (_readError) {
    return error(500, config.errorCode + '_read_failed', 'Unable to load the ' + config.label);
  }
  if (!postDocument.exists || !postDocument.document) {
    return error(404, 'not_found', config.label + ' not found', { postId: postId });
  }

  const existingData = postDocument.document.data || {};
  postData.authorName = existingData.authorName || postData.authorName;
  postData.authorEmail = existingData.authorEmail || postData.authorEmail;
  if (config.teamId && !postData.teamId) {
    postData.teamId = existingData.teamId || config.teamId;
  }

  const changedFields = diffFields(existingData, postData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, config.collection + '/' + postId, postData, Object.keys(postData));
    await writeAudit(context, {
      adminAction: config.auditAction,
      action: 'update',
      collection: config.collection,
      documentId: postId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    return json({ ok: true, action: config.auditAction, mode: 'update', postId: postId, changedFields: changedFields, collection: config.collection, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, config.errorCode + '_update_failed', 'Unable to update the ' + config.label, { postId: postId, message: writeError.message });
  }
}

async function deleteForumPostInCollection(request, config) {
  let context;
  try {
    context = await requirePermission(request, config.deletePermission);
  } catch (authError) {
    return errorFromException(authError, config.errorCode + '_failed', config.label + ' delete failed');
  }

  let postDocument;
  try {
    postDocument = await getDocument(context.idToken, config.collection + '/' + config.data.postId);
  } catch (_readError) {
    return error(500, config.errorCode + '_read_failed', 'Unable to load the ' + config.label);
  }
  if (!postDocument.exists || !postDocument.document) {
    return error(404, 'not_found', config.label + ' not found', { postId: config.data.postId });
  }

  const title = String((postDocument.document.data || {}).title || config.data.title || config.data.postId);
  try {
    const deletedReplies = await deleteDocumentsByField(context.idToken, config.replyCollection, 'postId', config.data.postId);
    await deleteDocument(context.idToken, config.collection + '/' + config.data.postId);
    await writeAudit(context, {
      adminAction: config.auditAction,
      action: 'delete',
      collection: config.collection,
      documentId: config.data.postId,
      changes: 'Deleted: ' + title + (deletedReplies ? '; Replies deleted: ' + deletedReplies : '')
    });
    return json({ ok: true, action: config.auditAction, postId: config.data.postId, deletedReplies: deletedReplies, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, config.errorCode + '_delete_failed', 'Unable to delete the ' + config.label, { postId: config.data.postId, message: writeError.message });
  }
}

async function pinForumPostInCollection(request, config) {
  let context;
  try {
    context = await requirePermission(request, config.moderatePermission);
  } catch (authError) {
    return errorFromException(authError, config.errorCode + '_failed', config.label + ' pin failed');
  }

  let postDocument;
  try {
    postDocument = await getDocument(context.idToken, config.collection + '/' + config.data.postId);
  } catch (_readError) {
    return error(500, config.errorCode + '_read_failed', 'Unable to load the ' + config.label);
  }
  if (!postDocument.exists || !postDocument.document) {
    return error(404, 'not_found', config.label + ' not found', { postId: config.data.postId });
  }

  try {
    await patchDocument(context.idToken, config.collection + '/' + config.data.postId, {
      pinned: Boolean(config.data.pinned),
      lastEditedAt: new Date()
    }, ['pinned', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: config.auditAction,
      action: 'update',
      collection: config.collection,
      documentId: config.data.postId,
      changes: 'Pinned: ' + String(Boolean(config.data.pinned))
    });
    return json({ ok: true, action: config.auditAction, postId: config.data.postId, pinned: Boolean(config.data.pinned), reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, config.errorCode + '_pin_failed', 'Unable to update the ' + config.label + ' pin state', { postId: config.data.postId, message: writeError.message });
  }
}

async function saveForumReplyInCollection(request, config) {
  let context;
  try {
    context = await requirePermission(request, config.createPermission);
  } catch (authError) {
    return errorFromException(authError, config.errorCode + '_failed', config.label + ' save failed');
  }

  let postDocument;
  try {
    postDocument = await getDocument(context.idToken, config.postCollection + '/' + config.data.postId);
  } catch (_readError) {
    return error(500, config.errorCode + '_post_read_failed', 'Unable to load the parent post');
  }
  if (!postDocument.exists || !postDocument.document) {
    return error(404, 'not_found', 'Parent post not found', { postId: config.data.postId });
  }

  const replyId = String(config.data.replyId || '').trim();
  const replyData = {
    postId: config.data.postId,
    body: config.data.body,
    authorName: defaultAuthorName(context.identity.email),
    authorEmail: context.identity.email
  };

  if (replyId) {
    let replyDocument;
    try {
      replyDocument = await getDocument(context.idToken, config.collection + '/' + replyId);
    } catch (_replyReadError) {
      return error(500, config.errorCode + '_read_failed', 'Unable to load the reply');
    }
    if (!replyDocument.exists || !replyDocument.document) {
      return error(404, 'not_found', 'Reply not found', { replyId: replyId });
    }
    const updateData = { body: replyData.body };
    const changedFields = diffFields(replyDocument.document.data || {}, updateData, []);
    try {
      await patchDocument(context.idToken, config.collection + '/' + replyId, updateData, Object.keys(updateData));
      await writeAudit(context, {
        adminAction: config.auditAction,
        action: 'update',
        collection: config.collection,
        documentId: replyId,
        changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
      });
      return json({ ok: true, action: config.auditAction, mode: 'update', replyId: replyId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (writeError) {
      return error(500, config.errorCode + '_update_failed', 'Unable to update the reply', { replyId: replyId, message: writeError.message });
    }
  }

  try {
    const created = await createDocument(context.idToken, config.collection, Object.assign({}, replyData, { createdAt: new Date() }));
    await writeAudit(context, {
      adminAction: config.auditAction,
      action: 'create',
      collection: config.collection,
      documentId: created.id,
      changes: 'Reply on ' + config.data.postId
    });
    return json({ ok: true, action: config.auditAction, mode: 'create', replyId: created.id, postId: config.data.postId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (createError) {
    return error(500, config.errorCode + '_create_failed', 'Unable to create the reply', { message: createError.message });
  }
}

async function deleteForumReplyInCollection(request, config) {
  let context;
  try {
    context = await requirePermission(request, config.deletePermission);
  } catch (authError) {
    return errorFromException(authError, config.errorCode + '_failed', config.label + ' delete failed');
  }

  let replyDocument;
  try {
    replyDocument = await getDocument(context.idToken, config.collection + '/' + config.data.replyId);
  } catch (_readError) {
    return error(500, config.errorCode + '_read_failed', 'Unable to load the reply');
  }
  if (!replyDocument.exists || !replyDocument.document) {
    return error(404, 'not_found', 'Reply not found', { replyId: config.data.replyId });
  }

  try {
    await deleteDocument(context.idToken, config.collection + '/' + config.data.replyId);
    await writeAudit(context, {
      adminAction: config.auditAction,
      action: 'delete',
      collection: config.collection,
      documentId: config.data.replyId,
      changes: 'Deleted reply'
    });
    return json({ ok: true, action: config.auditAction, replyId: config.data.replyId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, config.errorCode + '_delete_failed', 'Unable to delete the reply', { replyId: config.data.replyId, message: writeError.message });
  }
}

async function handleForumPostSave(request, data) {
  const routedTeamId = String(data.teamId || '').trim();
  if (routedTeamId) {
    return saveForumPostInCollection(request, {
      data: { postId: data.postId, title: data.title, body: data.body, pinned: data.pinned },
      collection: 'team_forums',
      label: 'team forum post',
      errorCode: 'team_forum_post_save',
      auditAction: 'forum.post.save',
      createPermission: 'team_forums.create',
      updatePermission: 'team_forums.edit',
      teamId: routedTeamId
    });
  }
  return saveForumPostInCollection(request, {
    data: data,
    collection: 'forums',
    label: 'forum post',
    errorCode: 'forum_post_save',
    auditAction: 'forum.post.save',
    createPermission: 'forums.create',
    updatePermission: 'forums.edit_any',
    includeCategory: true
  });
}

async function handleForumPostDelete(request, data) {
  if (String(data.teamId || '').trim()) {
    return deleteForumPostInCollection(request, {
      data: data,
      collection: 'team_forums',
      replyCollection: 'team_forum_replies',
      label: 'team forum post',
      errorCode: 'team_forum_post_delete',
      auditAction: 'forum.post.delete',
      deletePermission: 'team_forums.delete'
    });
  }
  return deleteForumPostInCollection(request, {
    data: data,
    collection: 'forums',
    replyCollection: 'forum_replies',
    label: 'forum post',
    errorCode: 'forum_post_delete',
    auditAction: 'forum.post.delete',
    deletePermission: 'forums.delete_any'
  });
}

async function handleForumPostPin(request, data) {
  if (String(data.teamId || '').trim()) {
    return pinForumPostInCollection(request, {
      data: data,
      collection: 'team_forums',
      label: 'team forum post',
      errorCode: 'team_forum_post_pin',
      auditAction: 'forum.post.pin',
      moderatePermission: 'team_forums.moderate'
    });
  }
  return pinForumPostInCollection(request, {
    data: data,
    collection: 'forums',
    label: 'forum post',
    errorCode: 'forum_post_pin',
    auditAction: 'forum.post.pin',
    moderatePermission: 'forums.moderate'
  });
}

async function handleForumReplySave(request, data) {
  if (String(data.teamId || '').trim()) {
    return saveForumReplyInCollection(request, {
      data: data,
      collection: 'team_forum_replies',
      postCollection: 'team_forums',
      label: 'team forum reply',
      errorCode: 'team_forum_reply_save',
      auditAction: 'forum.reply.save',
      createPermission: 'team_forums.create'
    });
  }
  return saveForumReplyInCollection(request, {
    data: data,
    collection: 'forum_replies',
    postCollection: 'forums',
    label: 'forum reply',
    errorCode: 'forum_reply_save',
    auditAction: 'forum.reply.save',
    createPermission: 'forums.create'
  });
}

async function handleForumReplyDelete(request, data) {
  if (String(data.teamId || '').trim()) {
    return deleteForumReplyInCollection(request, {
      data: data,
      collection: 'team_forum_replies',
      label: 'team forum reply',
      errorCode: 'team_forum_reply_delete',
      auditAction: 'forum.reply.delete',
      deletePermission: 'team_forums.delete'
    });
  }
  return deleteForumReplyInCollection(request, {
    data: data,
    collection: 'forum_replies',
    label: 'forum reply',
    errorCode: 'forum_reply_delete',
    auditAction: 'forum.reply.delete',
    deletePermission: 'forums.delete_any'
  });
}

async function handleTeamForumPostSave(request, data) {
  return saveForumPostInCollection(request, {
    data: data,
    collection: 'team_forums',
    label: 'team forum post',
    errorCode: 'team_forum_post_save',
    auditAction: 'team_forum.post.save',
    createPermission: 'team_forums.create',
    updatePermission: 'team_forums.edit',
    teamId: data.teamId
  });
}

async function handleTeamForumPostDelete(request, data) {
  return deleteForumPostInCollection(request, {
    data: data,
    collection: 'team_forums',
    replyCollection: 'team_forum_replies',
    label: 'team forum post',
    errorCode: 'team_forum_post_delete',
    auditAction: 'team_forum.post.delete',
    deletePermission: 'team_forums.delete'
  });
}

async function handleTeamForumPostPin(request, data) {
  return pinForumPostInCollection(request, {
    data: data,
    collection: 'team_forums',
    label: 'team forum post',
    errorCode: 'team_forum_post_pin',
    auditAction: 'team_forum.post.pin',
    moderatePermission: 'team_forums.moderate'
  });
}

async function handleTeamForumReplySave(request, data) {
  return saveForumReplyInCollection(request, {
    data: data,
    collection: 'team_forum_replies',
    postCollection: 'team_forums',
    label: 'team forum reply',
    errorCode: 'team_forum_reply_save',
    auditAction: 'team_forum.reply.save',
    createPermission: 'team_forums.create'
  });
}

async function handleTeamForumReplyDelete(request, data) {
  return deleteForumReplyInCollection(request, {
    data: data,
    collection: 'team_forum_replies',
    label: 'team forum reply',
    errorCode: 'team_forum_reply_delete',
    auditAction: 'team_forum.reply.delete',
    deletePermission: 'team_forums.delete'
  });
}

async function handleSettingsSaveAll(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'settings.edit');
  } catch (authError) {
    return errorFromException(authError, 'settings_save_all_failed', 'Settings save failed');
  }

  const entries = data.entries.map(function(entry) {
    return {
      key: entry.key,
      value: entry.value
    };
  });

  try {
    await Promise.all(entries.map(async function(entry) {
      const documentPath = 'settings/' + entry.key;
      const existing = await getDocument(context.idToken, documentPath);
      const payload = {
        key: entry.key,
        value: entry.value,
        updatedAt: new Date(),
        updatedBy: context.identity.email
      };
      if (existing.exists) {
        await patchDocument(context.idToken, documentPath, payload, Object.keys(payload));
      } else {
        await createDocument(context.idToken, 'settings', payload, entry.key);
      }
    }));
    await writeAudit(context, {
      adminAction: 'settings.save_all',
      action: 'update',
      collection: 'settings',
      documentId: 'all',
      changes: 'Updated: ' + entries.map(function(entry) { return entry.key + '=' + entry.value; }).join(', ')
    });
    return json({ ok: true, action: 'settings.save_all', count: entries.length, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, 'settings_save_all_failed', 'Unable to save settings', { message: writeError.message });
  }
}

async function handleUserPermissionsSave(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'users.assign_permissions');
  } catch (authError) {
    return errorFromException(authError, 'user_permissions_save_failed', 'User permission save failed');
  }

  const email = String(data.email || '').trim().toLowerCase();
  let existingDocument;
  try {
    existingDocument = await getDocument(context.idToken, 'users/' + email);
  } catch (_readError) {
    return error(500, 'user_read_failed', 'Unable to load the user document');
  }

  const existingData = existingDocument.exists && existingDocument.document ? existingDocument.document.data || {} : null;
  const isCreate = !existingData;
  const nextStatus = String(data.status || '').trim() || (existingData ? String(existingData.status || 'active') : 'pending');
  const userData = {
    roles: data.roles,
    role: data.roles[0],
    email: email,
    permission_overrides: data.permissionOverrides,
    permissions: data.permissions,
    status: nextStatus,
    lastEditedAt: new Date()
  };
  if (existingData && existingData.addedAt) {
    userData.addedAt = existingData.addedAt;
  } else {
    userData.addedAt = new Date();
  }
  if (existingData && existingData.createdAt) {
    userData.createdAt = existingData.createdAt;
  } else {
    userData.createdAt = new Date();
  }

  const changedFields = diffFields(existingData || {}, userData, ['lastEditedAt']);
  try {
    if (isCreate) {
      await createDocument(context.idToken, 'users', userData, email);
    } else {
      await patchDocument(context.idToken, 'users/' + email, userData, Object.keys(userData));
    }
    await writeAudit(context, {
      adminAction: 'user.permissions.save',
      action: isCreate ? 'create' : 'update',
      collection: 'users',
      documentId: email,
      changes: isCreate ? 'Created user doc with roles: ' + data.roles.join(', ') : (changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes')
    });
    return json({ ok: true, action: 'user.permissions.save', mode: isCreate ? 'create' : 'update', email: email, status: nextStatus, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, 'user_permissions_save_failed', 'Unable to save the user document', { email: email, message: writeError.message });
  }
}

async function handleUserDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'users.assign_permissions');
  } catch (authError) {
    return errorFromException(authError, 'user_delete_failed', 'User delete failed');
  }

  const email = String(data.email || '').trim().toLowerCase();
  if (email === context.identity.email) {
    return error(403, 'cannot_delete_self', 'You cannot delete your own user document');
  }

  let userDocument;
  try {
    userDocument = await getDocument(context.idToken, 'users/' + email);
  } catch (_readError) {
    return error(500, 'user_read_failed', 'Unable to load the user document');
  }
  if (!userDocument.exists || !userDocument.document) {
    return error(404, 'not_found', 'User document not found', { email: email });
  }

  try {
    await deleteDocument(context.idToken, 'users/' + email);
    await writeAudit(context, {
      adminAction: 'user.delete',
      action: 'delete',
      collection: 'users',
      documentId: email,
      changes: 'Removed user document'
    });
    return json({ ok: true, action: 'user.delete', email: email, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, 'user_delete_failed', 'Unable to delete the user document', { email: email, message: writeError.message });
  }
}

async function handleAnnouncementSave(request, data) {
  const announcementId = String(data.announcementId || '').trim();
  const isUpdate = Boolean(announcementId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['announcements.edit'] : ['announcements.create']);
  } catch (authError) {
    return errorFromException(authError, 'announcement_save_failed', 'Announcement save failed');
  }

  let announcementDocument = null;
  if (isUpdate) {
    try {
      announcementDocument = await getDocument(context.idToken, 'announcements/' + announcementId);
    } catch (readError) {
      log('admin-mutate-announcement-save', 'error', {
        code: 'announcement_read_failed',
        announcementId: announcementId,
        actor: context.identity.email,
        status: readError.status || 500,
        message: readError.message
      });
      return error(500, 'announcement_read_failed', 'Unable to load the announcement');
    }

    if (!announcementDocument.exists || !announcementDocument.document) {
      return error(404, 'not_found', 'Announcement not found', { announcementId: announcementId });
    }
  }

  let expiresAt;
  try {
    expiresAt = parseOptionalDateTime(data.expiresAt, 'invalid_expires_at', 'Announcement expiry');
  } catch (buildError) {
    return errorFromException(buildError, 'announcement_save_failed', 'Announcement save failed');
  }

  const existingData = announcementDocument && announcementDocument.document ? announcementDocument.document.data || {} : null;
  const announcementData = {
    title: data.title,
    body: data.body,
    type: data.type,
    audience: data.audience,
    active: data.active,
    createdBy: (existingData && existingData.createdBy) || context.identity.email,
    expiresAt: expiresAt,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'announcements', Object.assign({}, announcementData, { publishedAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'announcement.save',
        action: 'create',
        collection: 'announcements',
        documentId: created.id,
        changes: 'Created: ' + data.title
      });
      log('admin-mutate-announcement-save', 'log', {
        code: 'announcement_created',
        announcementId: created.id,
        actor: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
      return json({ ok: true, action: 'announcement.save', mode: 'create', announcementId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      log('admin-mutate-announcement-save', 'error', {
        code: 'announcement_create_failed',
        actor: context.identity.email,
        status: createError.status || 500,
        message: createError.message,
        body: createError.body || ''
      });
      return error(500, 'announcement_create_failed', 'Unable to create the announcement');
    }
  }

  const changedFields = diffFields(existingData || {}, announcementData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'announcements/' + announcementId, announcementData, Object.keys(announcementData));
    await writeAudit(context, {
      adminAction: 'announcement.save',
      action: 'update',
      collection: 'announcements',
      documentId: announcementId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    log('admin-mutate-announcement-save', 'log', {
      code: 'announcement_updated',
      announcementId: announcementId,
      actor: context.identity.email,
      changedFields: changedFields,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'announcement.save', mode: 'update', announcementId: announcementId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-announcement-save', 'error', {
      code: 'announcement_update_failed',
      announcementId: announcementId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'announcement_update_failed', 'Unable to update the announcement', { announcementId: announcementId });
  }
}

async function handleAnnouncementToggle(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'announcements.edit');
  } catch (authError) {
    return errorFromException(authError, 'announcement_toggle_failed', 'Announcement toggle failed');
  }

  let announcementDocument;
  try {
    announcementDocument = await getDocument(context.idToken, 'announcements/' + data.announcementId);
  } catch (readError) {
    log('admin-mutate-announcement-toggle', 'error', {
      code: 'announcement_read_failed',
      announcementId: data.announcementId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'announcement_read_failed', 'Unable to load the announcement');
  }

  if (!announcementDocument.exists || !announcementDocument.document) {
    return error(404, 'not_found', 'Announcement not found', { announcementId: data.announcementId });
  }

  const existingData = announcementDocument.document.data || {};
  const previousActive = existingData.active !== false;
  if (previousActive === data.active) {
    return json({ ok: true, action: 'announcement.toggle', announcementId: data.announcementId, active: data.active, previousActive: previousActive, noChange: true });
  }

  try {
    await patchDocument(context.idToken, 'announcements/' + data.announcementId, {
      active: data.active,
      lastEditedAt: new Date()
    }, ['active', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: 'announcement.toggle',
      action: 'update',
      collection: 'announcements',
      documentId: data.announcementId,
      changes: 'Active: ' + String(data.active)
    });
    log('admin-mutate-announcement-toggle', 'log', {
      code: 'announcement_toggled',
      announcementId: data.announcementId,
      actor: context.identity.email,
      previousActive: previousActive,
      nextActive: data.active,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'announcement.toggle', announcementId: data.announcementId, active: data.active, previousActive: previousActive, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-announcement-toggle', 'error', {
      code: 'announcement_toggle_failed',
      announcementId: data.announcementId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'announcement_toggle_failed', 'Unable to update the announcement state', { announcementId: data.announcementId });
  }
}

async function handleAnnouncementDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'announcements.delete');
  } catch (authError) {
    return errorFromException(authError, 'announcement_delete_failed', 'Announcement delete failed');
  }

  let announcementDocument;
  try {
    announcementDocument = await getDocument(context.idToken, 'announcements/' + data.announcementId);
  } catch (readError) {
    log('admin-mutate-announcement-delete', 'error', {
      code: 'announcement_read_failed',
      announcementId: data.announcementId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'announcement_read_failed', 'Unable to load the announcement');
  }

  if (!announcementDocument.exists || !announcementDocument.document) {
    return error(404, 'not_found', 'Announcement not found', { announcementId: data.announcementId });
  }

  const announcementTitle = String((announcementDocument.document.data || {}).title || data.title || data.announcementId);
  try {
    await deleteDocument(context.idToken, 'announcements/' + data.announcementId);
    await writeAudit(context, {
      adminAction: 'announcement.delete',
      action: 'delete',
      collection: 'announcements',
      documentId: data.announcementId,
      changes: 'Deleted: ' + announcementTitle
    });
    log('admin-mutate-announcement-delete', 'log', {
      code: 'announcement_deleted',
      announcementId: data.announcementId,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'announcement.delete', announcementId: data.announcementId, deletedTitle: announcementTitle, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-announcement-delete', 'error', {
      code: 'announcement_delete_failed',
      announcementId: data.announcementId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'announcement_delete_failed', 'Unable to delete the announcement', { announcementId: data.announcementId });
  }
}

async function handleEventSave(request, data) {
  const eventId = String(data.eventId || '').trim();
  const isUpdate = Boolean(eventId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['events.edit'] : ['events.create']);
  } catch (authError) {
    return errorFromException(authError, 'event_save_failed', 'Event save failed');
  }

  let eventData;
  try {
    eventData = {
      title: data.title,
      description: data.description,
      date: parseRequiredDateTime(data.date, 'invalid_event_date', 'Event date'),
      endDate: parseOptionalDateTime(data.endDate, 'invalid_event_end_date', 'Event end date'),
      location: data.location,
      type: data.type,
      status: data.status,
      owner: data.owner.toLowerCase(),
      collaborators: data.collaborators.map(function(collaborator) { return collaborator.toLowerCase(); }),
      capacity: data.capacity,
      lastEditedAt: new Date()
    };
  } catch (buildError) {
    return errorFromException(buildError, 'event_save_failed', 'Event save failed');
  }

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'events', Object.assign({}, eventData, { createdAt: new Date(), signups: [] }));
      await writeAudit(context, {
        adminAction: 'event.save',
        action: 'create',
        collection: 'events',
        documentId: created.id,
        changes: 'Created: ' + data.title
      });
      log('admin-mutate-event-save', 'log', {
        code: 'event_created',
        eventId: created.id,
        actor: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
      return json({ ok: true, action: 'event.save', mode: 'create', eventId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      log('admin-mutate-event-save', 'error', {
        code: 'event_create_failed',
        actor: context.identity.email,
        status: createError.status || 500,
        message: createError.message,
        body: createError.body || ''
      });
      return error(500, 'event_create_failed', 'Unable to create the event');
    }
  }

  let eventDocument;
  try {
    eventDocument = await getDocument(context.idToken, 'events/' + eventId);
  } catch (readError) {
    log('admin-mutate-event-save', 'error', {
      code: 'event_read_failed',
      eventId: eventId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'event_read_failed', 'Unable to load the event');
  }

  if (!eventDocument.exists || !eventDocument.document) {
    return error(404, 'not_found', 'Event not found', { eventId: eventId });
  }

  const changedFields = diffFields(eventDocument.document.data || {}, eventData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'events/' + eventId, eventData, Object.keys(eventData));
    await writeAudit(context, {
      adminAction: 'event.save',
      action: 'update',
      collection: 'events',
      documentId: eventId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    log('admin-mutate-event-save', 'log', {
      code: 'event_updated',
      eventId: eventId,
      actor: context.identity.email,
      changedFields: changedFields,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'event.save', mode: 'update', eventId: eventId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-event-save', 'error', {
      code: 'event_update_failed',
      eventId: eventId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'event_update_failed', 'Unable to update the event', { eventId: eventId });
  }
}

async function handleEventDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'events.delete');
  } catch (authError) {
    return errorFromException(authError, 'event_delete_failed', 'Event delete failed');
  }

  let eventDocument;
  try {
    eventDocument = await getDocument(context.idToken, 'events/' + data.eventId);
  } catch (readError) {
    log('admin-mutate-event-delete', 'error', {
      code: 'event_read_failed',
      eventId: data.eventId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'event_read_failed', 'Unable to load the event');
  }

  if (!eventDocument.exists || !eventDocument.document) {
    return error(404, 'not_found', 'Event not found', { eventId: data.eventId });
  }

  const eventTitle = String((eventDocument.document.data || {}).title || data.title || data.eventId);
  try {
    await deleteDocument(context.idToken, 'events/' + data.eventId);
    await writeAudit(context, {
      adminAction: 'event.delete',
      action: 'delete',
      collection: 'events',
      documentId: data.eventId,
      changes: 'Deleted: ' + eventTitle
    });
    log('admin-mutate-event-delete', 'log', {
      code: 'event_deleted',
      eventId: data.eventId,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'event.delete', eventId: data.eventId, deletedTitle: eventTitle, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-event-delete', 'error', {
      code: 'event_delete_failed',
      eventId: data.eventId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'event_delete_failed', 'Unable to delete the event', { eventId: data.eventId });
  }
}

async function handleLedgerSave(request, data) {
  const ledgerId = String(data.ledgerId || '').trim();
  const isUpdate = Boolean(ledgerId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['ledger.edit'] : ['ledger.create']);
  } catch (authError) {
    return errorFromException(authError, 'ledger_save_failed', 'Ledger save failed');
  }

  let ledgerData;
  try {
    ledgerData = {
      date: parseRequiredDate(data.date, 'invalid_ledger_date', 'Ledger date'),
      description: data.description,
      category: data.category,
      amount: data.amount,
      direction: data.direction,
      program: data.program,
      sourceName: data.sourceName,
      notes: data.notes,
      lastEditedAt: new Date()
    };
  } catch (buildError) {
    return errorFromException(buildError, 'ledger_save_failed', 'Ledger save failed');
  }

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'ledger', Object.assign({}, ledgerData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'ledger.save',
        action: 'create',
        collection: 'ledger',
        documentId: created.id,
        changes: 'Created: ' + data.description
      });
      log('admin-mutate-ledger-save', 'log', {
        code: 'ledger_created',
        ledgerId: created.id,
        actor: context.identity.email,
        automation: Boolean(context.isAutomation)
      });
      return json({ ok: true, action: 'ledger.save', mode: 'create', ledgerId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (createError) {
      log('admin-mutate-ledger-save', 'error', {
        code: 'ledger_create_failed',
        actor: context.identity.email,
        status: createError.status || 500,
        message: createError.message,
        body: createError.body || ''
      });
      return error(500, 'ledger_create_failed', 'Unable to create the ledger entry');
    }
  }

  let ledgerDocument;
  try {
    ledgerDocument = await getDocument(context.idToken, 'ledger/' + ledgerId);
  } catch (readError) {
    log('admin-mutate-ledger-save', 'error', {
      code: 'ledger_read_failed',
      ledgerId: ledgerId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'ledger_read_failed', 'Unable to load the ledger entry');
  }

  if (!ledgerDocument.exists || !ledgerDocument.document) {
    return error(404, 'not_found', 'Ledger entry not found', { ledgerId: ledgerId });
  }

  const changedFields = diffFields(ledgerDocument.document.data || {}, ledgerData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'ledger/' + ledgerId, ledgerData, Object.keys(ledgerData));
    await writeAudit(context, {
      adminAction: 'ledger.save',
      action: 'update',
      collection: 'ledger',
      documentId: ledgerId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    log('admin-mutate-ledger-save', 'log', {
      code: 'ledger_updated',
      ledgerId: ledgerId,
      actor: context.identity.email,
      changedFields: changedFields,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'ledger.save', mode: 'update', ledgerId: ledgerId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-ledger-save', 'error', {
      code: 'ledger_update_failed',
      ledgerId: ledgerId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'ledger_update_failed', 'Unable to update the ledger entry', { ledgerId: ledgerId });
  }
}

async function handleLedgerDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'ledger.delete');
  } catch (authError) {
    return errorFromException(authError, 'ledger_delete_failed', 'Ledger delete failed');
  }

  let ledgerDocument;
  try {
    ledgerDocument = await getDocument(context.idToken, 'ledger/' + data.ledgerId);
  } catch (readError) {
    log('admin-mutate-ledger-delete', 'error', {
      code: 'ledger_read_failed',
      ledgerId: data.ledgerId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'ledger_read_failed', 'Unable to load the ledger entry');
  }

  if (!ledgerDocument.exists || !ledgerDocument.document) {
    return error(404, 'not_found', 'Ledger entry not found', { ledgerId: data.ledgerId });
  }

  const ledgerData = ledgerDocument.document.data || {};
  const entryLabel = String(ledgerData.description || data.ledgerId);
  try {
    await deleteDocument(context.idToken, 'ledger/' + data.ledgerId);
    await writeAudit(context, {
      adminAction: 'ledger.delete',
      action: 'delete',
      collection: 'ledger',
      documentId: data.ledgerId,
      changes: 'Deleted: ' + entryLabel
    });
    log('admin-mutate-ledger-delete', 'log', {
      code: 'ledger_deleted',
      ledgerId: data.ledgerId,
      actor: context.identity.email,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'ledger.delete', ledgerId: data.ledgerId, deletedLabel: entryLabel, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-ledger-delete', 'error', {
      code: 'ledger_delete_failed',
      ledgerId: data.ledgerId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'ledger_delete_failed', 'Unable to delete the ledger entry', { ledgerId: data.ledgerId });
  }
}


async function handleVolunteerBulkStatus(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'volunteers.edit');
  } catch (authError) {
    return errorFromException(authError, 'volunteer_bulk_status_failed', 'Volunteer bulk status update failed');
  }

  const volunteerIds = uniqueStrings(data.volunteerIds);
  try {
    await Promise.all(volunteerIds.map(function(volunteerId) {
      return patchDocument(context.idToken, 'volunteers/' + volunteerId, {
        status: data.status,
        lastEditedAt: new Date()
      }, ['status', 'lastEditedAt']);
    }));
    await writeAudit(context, {
      adminAction: 'volunteer.bulk_status',
      action: 'update',
      collection: 'volunteers',
      documentId: '',
      changes: 'Bulk status update to ' + data.status + ' for ' + volunteerIds.length + ' volunteers'
    });
    log('admin-mutate-volunteer-bulk-status', 'log', {
      code: 'volunteer_bulk_status_updated',
      actor: context.identity.email,
      count: volunteerIds.length,
      status: data.status,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'volunteer.bulk_status', count: volunteerIds.length, status: data.status, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-volunteer-bulk-status', 'error', {
      code: 'volunteer_bulk_status_failed',
      actor: context.identity.email,
      count: volunteerIds.length,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'volunteer_bulk_status_failed', 'Unable to update volunteer statuses');
  }
}

async function handleBulkDelete(request, data) {
  const collectionPermissions = {
    volunteers: 'volunteers.delete',
    schools: 'schools.delete',
    ledger: 'ledger.delete',
    goals: 'goals.delete',
    outreach: 'outreach.delete',
    communities: 'communities.delete',
    ideas: 'ideas.delete_any'
  };
  const permission = collectionPermissions[data.collection];
  if (!permission) {
    return error(400, 'unsupported_collection', 'Bulk delete is not supported for that collection');
  }

  let context;
  try {
    context = await requirePermission(request, permission);
  } catch (authError) {
    return errorFromException(authError, 'bulk_delete_failed', 'Bulk delete failed');
  }

  const ids = uniqueStrings(data.ids);
  try {
    await Promise.all(ids.map(function(id) {
      return deleteDocument(context.idToken, data.collection + '/' + id);
    }));
    await writeAudit(context, {
      adminAction: 'bulk.delete',
      action: 'delete',
      collection: data.collection,
      documentId: '',
      changes: 'Bulk deleted ' + ids.length + ' item(s)'
    });
    log('admin-mutate-bulk-delete', 'log', {
      code: 'bulk_delete_completed',
      actor: context.identity.email,
      collection: data.collection,
      count: ids.length,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'bulk.delete', collection: data.collection, count: ids.length, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-bulk-delete', 'error', {
      code: 'bulk_delete_failed',
      actor: context.identity.email,
      collection: data.collection,
      count: ids.length,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'bulk_delete_failed', 'Unable to delete the selected items', { collection: data.collection });
  }
}

async function handleEventSignup(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'events.signup');
  } catch (authError) {
    return errorFromException(authError, 'event_signup_failed', 'Event signup failed');
  }

  let eventDocument;
  try {
    eventDocument = await getDocument(context.idToken, 'events/' + data.eventId);
  } catch (readError) {
    log('admin-mutate-event-signup', 'error', {
      code: 'event_read_failed',
      eventId: data.eventId,
      actor: context.identity.email,
      status: readError.status || 500,
      message: readError.message
    });
    return error(500, 'event_read_failed', 'Unable to load the event');
  }

  if (!eventDocument.exists || !eventDocument.document) {
    return error(404, 'not_found', 'Event not found', { eventId: data.eventId });
  }

  const eventData = eventDocument.document.data || {};
  const signups = Array.isArray(eventData.signups) ? eventData.signups.slice() : [];
  const email = context.identity.email;
  if (signups.indexOf(email) > -1) {
    return json({ ok: true, action: 'event.signup', eventId: data.eventId, noChange: true, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  }
  const capacity = Number(eventData.capacity || 0);
  if (capacity && signups.length >= capacity) {
    return error(409, 'event_full', 'Event is already full', { eventId: data.eventId });
  }
  signups.push(email);

  try {
    await patchDocument(context.idToken, 'events/' + data.eventId, {
      signups: signups,
      lastEditedAt: new Date()
    }, ['signups', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: 'event.signup',
      action: 'update',
      collection: 'events',
      documentId: data.eventId,
      changes: 'Signup: ' + email
    });
    log('admin-mutate-event-signup', 'log', {
      code: 'event_signup_completed',
      eventId: data.eventId,
      actor: context.identity.email,
      signupCount: signups.length,
      automation: Boolean(context.isAutomation)
    });
    return json({ ok: true, action: 'event.signup', eventId: data.eventId, signups: signups.length, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-event-signup', 'error', {
      code: 'event_signup_failed',
      eventId: data.eventId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'event_signup_failed', 'Unable to sign up for the event');
  }
}

async function handleGoalSave(request, data) {
  const goalId = String(data.goalId || '').trim();
  const isUpdate = Boolean(goalId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['goals.edit'] : ['goals.create']);
  } catch (authError) {
    return errorFromException(authError, 'goal_save_failed', 'Goal save failed');
  }

  let deadline;
  try {
    deadline = parseOptionalDate(data.deadline, 'invalid_goal_deadline', 'Goal deadline');
  } catch (buildError) {
    return errorFromException(buildError, 'goal_save_failed', 'Goal save failed');
  }

  const goalData = {
    title: data.title,
    description: data.description,
    targetValue: data.targetValue,
    currentValue: data.currentValue,
    unit: data.unit,
    deadline: deadline,
    category: data.category,
    status: data.status,
    assignee: data.assignee,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'goals', Object.assign({}, goalData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'goal.save',
        action: 'create',
        collection: 'goals',
        documentId: created.id,
        changes: 'Created: ' + data.title
      });
      return json({ ok: true, action: 'goal.save', mode: 'create', goalId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (writeError) {
      log('admin-mutate-goal-save', 'error', {
        code: 'goal_create_failed',
        actor: context.identity.email,
        status: writeError.status || 500,
        message: writeError.message,
        body: writeError.body || ''
      });
      return error(500, 'goal_create_failed', 'Unable to create the goal');
    }
  }

  let goalDocument;
  try {
    goalDocument = await getDocument(context.idToken, 'goals/' + goalId);
  } catch (readError) {
    return error(500, 'goal_read_failed', 'Unable to load the goal');
  }
  if (!goalDocument.exists || !goalDocument.document) {
    return error(404, 'not_found', 'Goal not found', { goalId: goalId });
  }

  const changedFields = diffFields(goalDocument.document.data || {}, goalData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'goals/' + goalId, goalData, Object.keys(goalData));
    await writeAudit(context, {
      adminAction: 'goal.save',
      action: 'update',
      collection: 'goals',
      documentId: goalId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    return json({ ok: true, action: 'goal.save', mode: 'update', goalId: goalId, changedFields: changedFields, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    log('admin-mutate-goal-save', 'error', {
      code: 'goal_update_failed',
      goalId: goalId,
      actor: context.identity.email,
      status: writeError.status || 500,
      message: writeError.message,
      body: writeError.body || ''
    });
    return error(500, 'goal_update_failed', 'Unable to update the goal');
  }
}

async function handleGoalDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'goals.delete');
  } catch (authError) {
    return errorFromException(authError, 'goal_delete_failed', 'Goal delete failed');
  }
  let goalDocument;
  try {
    goalDocument = await getDocument(context.idToken, 'goals/' + data.goalId);
  } catch (_readError) {
    return error(500, 'goal_read_failed', 'Unable to load the goal');
  }
  if (!goalDocument.exists || !goalDocument.document) {
    return error(404, 'not_found', 'Goal not found', { goalId: data.goalId });
  }
  const goalTitle = String((goalDocument.document.data || {}).title || data.title || data.goalId);
  try {
    await deleteDocument(context.idToken, 'goals/' + data.goalId);
    await writeAudit(context, {
      adminAction: 'goal.delete',
      action: 'delete',
      collection: 'goals',
      documentId: data.goalId,
      changes: 'Deleted: ' + goalTitle
    });
    return json({ ok: true, action: 'goal.delete', goalId: data.goalId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (writeError) {
    return error(500, 'goal_delete_failed', 'Unable to delete the goal');
  }
}

async function handleGoalProgress(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'goals.update_progress');
  } catch (authError) {
    return errorFromException(authError, 'goal_progress_failed', 'Goal progress update failed');
  }
  let goalDocument;
  try {
    goalDocument = await getDocument(context.idToken, 'goals/' + data.goalId);
  } catch (_readError) {
    return error(500, 'goal_read_failed', 'Unable to load the goal');
  }
  if (!goalDocument.exists || !goalDocument.document) {
    return error(404, 'not_found', 'Goal not found', { goalId: data.goalId });
  }
  const previousValue = Number((goalDocument.document.data || {}).currentValue || 0);
  try {
    await patchDocument(context.idToken, 'goals/' + data.goalId, {
      currentValue: data.currentValue,
      lastEditedAt: new Date()
    }, ['currentValue', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: 'goal.progress',
      action: 'update',
      collection: 'goals',
      documentId: data.goalId,
      changes: 'Progress: ' + previousValue + ' -> ' + data.currentValue + (data.note ? ' (' + data.note + ')' : '')
    });
    return json({ ok: true, action: 'goal.progress', goalId: data.goalId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'goal_progress_failed', 'Unable to update goal progress');
  }
}

async function handleOutreachSave(request, data) {
  const outreachId = String(data.outreachId || '').trim();
  const isUpdate = Boolean(outreachId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['outreach.edit'] : ['outreach.create']);
  } catch (authError) {
    return errorFromException(authError, 'outreach_save_failed', 'Outreach save failed');
  }

  let dateValue;
  try {
    dateValue = parseOptionalDate(data.date, 'invalid_outreach_date', 'Outreach date');
  } catch (buildError) {
    return errorFromException(buildError, 'outreach_save_failed', 'Outreach save failed');
  }

  const outreachData = {
    title: data.title,
    description: data.description,
    date: dateValue,
    location: data.location,
    type: data.type,
    targetAudience: data.targetAudience,
    attendees: data.attendees,
    outcome: data.outcome,
    status: data.status,
    linkedEvent: data.linkedEvent || null,
    photos: data.photos,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'outreach', Object.assign({}, outreachData, { createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'outreach.save',
        action: 'create',
        collection: 'outreach',
        documentId: created.id,
        changes: 'Created: ' + data.title
      });
      return json({ ok: true, action: 'outreach.save', mode: 'create', outreachId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (writeError) {
      return error(500, 'outreach_create_failed', 'Unable to create outreach entry');
    }
  }

  let outreachDocument;
  try {
    outreachDocument = await getDocument(context.idToken, 'outreach/' + outreachId);
  } catch (_readError) {
    return error(500, 'outreach_read_failed', 'Unable to load outreach entry');
  }
  if (!outreachDocument.exists || !outreachDocument.document) {
    return error(404, 'not_found', 'Outreach entry not found', { outreachId: outreachId });
  }

  const changedFields = diffFields(outreachDocument.document.data || {}, outreachData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'outreach/' + outreachId, outreachData, Object.keys(outreachData));
    await writeAudit(context, {
      adminAction: 'outreach.save',
      action: 'update',
      collection: 'outreach',
      documentId: outreachId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    return json({ ok: true, action: 'outreach.save', mode: 'update', outreachId: outreachId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'outreach_update_failed', 'Unable to update outreach entry');
  }
}

async function handleOutreachDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'outreach.delete');
  } catch (authError) {
    return errorFromException(authError, 'outreach_delete_failed', 'Outreach delete failed');
  }
  let outreachDocument;
  try {
    outreachDocument = await getDocument(context.idToken, 'outreach/' + data.outreachId);
  } catch (_readError) {
    return error(500, 'outreach_read_failed', 'Unable to load outreach entry');
  }
  if (!outreachDocument.exists || !outreachDocument.document) {
    return error(404, 'not_found', 'Outreach entry not found', { outreachId: data.outreachId });
  }
  const outreachTitle = String((outreachDocument.document.data || {}).title || data.title || data.outreachId);
  try {
    await deleteDocument(context.idToken, 'outreach/' + data.outreachId);
    await writeAudit(context, {
      adminAction: 'outreach.delete',
      action: 'delete',
      collection: 'outreach',
      documentId: data.outreachId,
      changes: 'Deleted: ' + outreachTitle
    });
    return json({ ok: true, action: 'outreach.delete', outreachId: data.outreachId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'outreach_delete_failed', 'Unable to delete outreach entry');
  }
}

async function handleTeamSave(request, data) {
  const teamId = String(data.teamId || '').trim();
  const isUpdate = Boolean(teamId);
  let context;
  try {
    context = await requireAnyPermission(request, isUpdate ? ['teams.edit'] : ['teams.create']);
  } catch (authError) {
    return errorFromException(authError, 'team_save_failed', 'Team save failed');
  }

  let leadDocument;
  try {
    leadDocument = await getDocument(context.idToken, 'volunteers/' + data.leadId);
  } catch (_leadReadError) {
    return error(500, 'team_lead_read_failed', 'Unable to load the team lead');
  }
  if (!leadDocument.exists || !leadDocument.document) {
    return error(404, 'lead_not_found', 'Team lead volunteer not found', { leadId: data.leadId });
  }

  const leadData = leadDocument.document.data || {};
  const teamData = {
    name: data.name,
    description: data.description,
    focusArea: data.focusArea,
    meetingSchedule: data.meetingSchedule,
    leadId: data.leadId,
    leadName: String(leadData.name || '').trim(),
    leadEmail: String(leadData.email || '').trim().toLowerCase(),
    status: data.status,
    lastEditedAt: new Date()
  };

  if (!isUpdate) {
    try {
      const created = await createDocument(context.idToken, 'teams', Object.assign({}, teamData, { members: [], createdAt: new Date() }));
      await writeAudit(context, {
        adminAction: 'team.save',
        action: 'create',
        collection: 'teams',
        documentId: created.id,
        changes: 'Created: ' + data.name
      });
      return json({ ok: true, action: 'team.save', mode: 'create', teamId: created.id, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
    } catch (_writeError) {
      return error(500, 'team_create_failed', 'Unable to create team');
    }
  }

  let teamDocument;
  try {
    teamDocument = await getDocument(context.idToken, 'teams/' + teamId);
  } catch (_readError) {
    return error(500, 'team_read_failed', 'Unable to load the team');
  }
  if (!teamDocument.exists || !teamDocument.document) {
    return error(404, 'not_found', 'Team not found', { teamId: teamId });
  }

  const changedFields = diffFields(teamDocument.document.data || {}, teamData, ['lastEditedAt']);
  try {
    await patchDocument(context.idToken, 'teams/' + teamId, teamData, Object.keys(teamData));
    await writeAudit(context, {
      adminAction: 'team.save',
      action: 'update',
      collection: 'teams',
      documentId: teamId,
      changes: changedFields.length ? 'Updated fields: ' + changedFields.join(', ') : 'No substantive field changes'
    });
    return json({ ok: true, action: 'team.save', mode: 'update', teamId: teamId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'team_update_failed', 'Unable to update team');
  }
}

async function handleTeamArchive(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'teams.edit');
  } catch (authError) {
    return errorFromException(authError, 'team_archive_failed', 'Team archive failed');
  }
  let teamDocument;
  try {
    teamDocument = await getDocument(context.idToken, 'teams/' + data.teamId);
  } catch (_readError) {
    return error(500, 'team_read_failed', 'Unable to load the team');
  }
  if (!teamDocument.exists || !teamDocument.document) {
    return error(404, 'not_found', 'Team not found', { teamId: data.teamId });
  }
  const currentStatus = String((teamDocument.document.data || {}).status || '');
  if (currentStatus === 'archived') {
    return json({ ok: true, action: 'team.archive', teamId: data.teamId, noChange: true, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  }
  try {
    await patchDocument(context.idToken, 'teams/' + data.teamId, { status: 'archived', lastEditedAt: new Date() }, ['status', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: 'team.archive',
      action: 'update',
      collection: 'teams',
      documentId: data.teamId,
      changes: 'Archived: ' + String((teamDocument.document.data || {}).name || data.name || data.teamId)
    });
    return json({ ok: true, action: 'team.archive', teamId: data.teamId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'team_archive_failed', 'Unable to archive team');
  }
}

async function handleTeamDelete(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'teams.delete');
  } catch (authError) {
    return errorFromException(authError, 'team_delete_failed', 'Team delete failed');
  }
  let teamDocument;
  try {
    teamDocument = await getDocument(context.idToken, 'teams/' + data.teamId);
  } catch (_readError) {
    return error(500, 'team_read_failed', 'Unable to load the team');
  }
  if (!teamDocument.exists || !teamDocument.document) {
    return error(404, 'not_found', 'Team not found', { teamId: data.teamId });
  }

  try {
    const forumPosts = await queryCollectionByField(context.idToken, 'team_forums', 'teamId', data.teamId);
    await Promise.all(forumPosts.map(function(post) {
      return deleteDocument(context.idToken, 'team_forums/' + post.id);
    }));
    await deleteDocument(context.idToken, 'teams/' + data.teamId);
    await writeAudit(context, {
      adminAction: 'team.delete',
      action: 'delete',
      collection: 'teams',
      documentId: data.teamId,
      changes: 'Deleted: ' + String((teamDocument.document.data || {}).name || data.name || data.teamId)
    });
    return json({ ok: true, action: 'team.delete', teamId: data.teamId, deletedForumPosts: forumPosts.length, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'team_delete_failed', 'Unable to delete team');
  }
}

async function handleTeamMemberAdd(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'teams.manage_members');
  } catch (authError) {
    return errorFromException(authError, 'team_member_add_failed', 'Add team member failed');
  }

  let teamDocument;
  let volunteerDocument;
  try {
    [teamDocument, volunteerDocument] = await Promise.all([
      getDocument(context.idToken, 'teams/' + data.teamId),
      getDocument(context.idToken, 'volunteers/' + data.volunteerId)
    ]);
  } catch (_readError) {
    return error(500, 'team_member_read_failed', 'Unable to load the team or volunteer');
  }
  if (!teamDocument.exists || !teamDocument.document) {
    return error(404, 'team_not_found', 'Team not found', { teamId: data.teamId });
  }
  if (!volunteerDocument.exists || !volunteerDocument.document) {
    return error(404, 'volunteer_not_found', 'Volunteer not found', { volunteerId: data.volunteerId });
  }

  const teamData = teamDocument.document.data || {};
  const members = Array.isArray(teamData.members) ? teamData.members.slice() : [];
  if (members.some(function(member) { return String(member.id || '') === data.volunteerId; })) {
    return json({ ok: true, action: 'team.member.add', teamId: data.teamId, volunteerId: data.volunteerId, noChange: true, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  }
  const member = buildTeamMember(volunteerDocument.document);
  members.push(member);
  try {
    await patchDocument(context.idToken, 'teams/' + data.teamId, { members: members, lastEditedAt: new Date() }, ['members', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: 'team.member.add',
      action: 'update',
      collection: 'teams',
      documentId: data.teamId,
      changes: 'Added member: ' + member.name
    });
    return json({ ok: true, action: 'team.member.add', teamId: data.teamId, volunteerId: data.volunteerId, member: member, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'team_member_add_failed', 'Unable to add the team member');
  }
}

async function handleTeamMemberRemove(request, data) {
  let context;
  try {
    context = await requirePermission(request, 'teams.manage_members');
  } catch (authError) {
    return errorFromException(authError, 'team_member_remove_failed', 'Remove team member failed');
  }

  let teamDocument;
  try {
    teamDocument = await getDocument(context.idToken, 'teams/' + data.teamId);
  } catch (_readError) {
    return error(500, 'team_read_failed', 'Unable to load the team');
  }
  if (!teamDocument.exists || !teamDocument.document) {
    return error(404, 'team_not_found', 'Team not found', { teamId: data.teamId });
  }
  const teamData = teamDocument.document.data || {};
  const members = Array.isArray(teamData.members) ? teamData.members.slice() : [];
  const nextMembers = members.filter(function(member) {
    return String(member.id || '') !== data.volunteerId;
  });
  if (nextMembers.length === members.length) {
    return json({ ok: true, action: 'team.member.remove', teamId: data.teamId, volunteerId: data.volunteerId, noChange: true, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  }
  const removedMember = members.find(function(member) {
    return String(member.id || '') === data.volunteerId;
  }) || null;
  try {
    await patchDocument(context.idToken, 'teams/' + data.teamId, { members: nextMembers, lastEditedAt: new Date() }, ['members', 'lastEditedAt']);
    await writeAudit(context, {
      adminAction: 'team.member.remove',
      action: 'update',
      collection: 'teams',
      documentId: data.teamId,
      changes: 'Removed member: ' + String((removedMember && removedMember.name) || data.volunteerId)
    });
    return json({ ok: true, action: 'team.member.remove', teamId: data.teamId, volunteerId: data.volunteerId, reviewedBy: context.identity.email, automation: Boolean(context.isAutomation) });
  } catch (_writeError) {
    return error(500, 'team_member_remove_failed', 'Unable to remove the team member');
  }
}

const handlers = {
  'volunteer.save': handleVolunteerSave,
  'volunteer.delete': handleVolunteerDelete,
  'idea.save': handleIdeaSave,
  'idea.delete': handleIdeaDelete,
  'forum.post.save': handleForumPostSave,
  'forum.post.delete': handleForumPostDelete,
  'forum.post.pin': handleForumPostPin,
  'forum.reply.save': handleForumReplySave,
  'forum.reply.delete': handleForumReplyDelete,
  'team_forum.post.save': handleTeamForumPostSave,
  'team_forum.post.delete': handleTeamForumPostDelete,
  'team_forum.post.pin': handleTeamForumPostPin,
  'team_forum.reply.save': handleTeamForumReplySave,
  'team_forum.reply.delete': handleTeamForumReplyDelete,
  'ledger.save': handleLedgerSave,
  'ledger.delete': handleLedgerDelete,
  'volunteer.bulk_status': handleVolunteerBulkStatus,
  'bulk.delete': handleBulkDelete,
  'school.save': handleSchoolSave,
  'school.delete': handleSchoolDelete,
  'community.save': handleCommunitySave,
  'community.delete': handleCommunityDelete,
  'community.seed_demo': handleCommunitySeedDemo,
  'announcement.save': handleAnnouncementSave,
  'announcement.toggle': handleAnnouncementToggle,
  'announcement.delete': handleAnnouncementDelete,
  'event.save': handleEventSave,
  'event.delete': handleEventDelete,
  'event.signup': handleEventSignup,
  'goal.save': handleGoalSave,
  'goal.delete': handleGoalDelete,
  'goal.progress': handleGoalProgress,
  'outreach.save': handleOutreachSave,
  'outreach.delete': handleOutreachDelete,
  'team.save': handleTeamSave,
  'team.archive': handleTeamArchive,
  'team.delete': handleTeamDelete,
  'team.member.add': handleTeamMemberAdd,
  'team.member.remove': handleTeamMemberRemove,
  'settings.save_all': handleSettingsSaveAll,
  'user.permissions.save': handleUserPermissionsSave,
  'user.delete': handleUserDelete
};

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (_parseError) {
    return error(400, 'invalid_json', 'Request body must be valid JSON');
  }

  const validation = validatePayload(payload);
  if (!validation.success) {
    return validation.response;
  }

  return handlers[validation.action](request, validation.data);
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
