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
  })
  ,
  'volunteer.bulk_status': z.object({
    action: z.literal('volunteer.bulk_status'),
    volunteerIds: z.array(z.string().trim().min(1).max(200)).min(1).max(100),
    status: z.string().trim().min(1).max(50)
  }),
  'bulk.delete': z.object({
    action: z.literal('bulk.delete'),
    collection: z.enum(['volunteers', 'schools', 'goals', 'outreach']),
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
    goals: 'goals.delete',
    outreach: 'outreach.delete'
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
  'volunteer.bulk_status': handleVolunteerBulkStatus,
  'bulk.delete': handleBulkDelete,
  'school.save': handleSchoolSave,
  'school.delete': handleSchoolDelete,
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
  'team.member.remove': handleTeamMemberRemove
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
