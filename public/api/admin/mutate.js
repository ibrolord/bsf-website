import { z } from 'zod';

import { requireAnyPermission, requirePermission } from '../_lib/auth.js';
import { createDocument, deleteDocument, getDocument, patchDocument } from '../_lib/firestore-rest.js';
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

const handlers = {
  'volunteer.save': handleVolunteerSave,
  'volunteer.delete': handleVolunteerDelete,
  'school.save': handleSchoolSave,
  'school.delete': handleSchoolDelete,
  'announcement.save': handleAnnouncementSave,
  'announcement.toggle': handleAnnouncementToggle,
  'announcement.delete': handleAnnouncementDelete,
  'event.save': handleEventSave,
  'event.delete': handleEventDelete
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
