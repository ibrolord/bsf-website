const DEFAULT_FIREBASE_PROJECT_ID = 'big-sister-foundation';

function getProjectId() {
  return process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
}

function encodeDocumentPath(documentPath) {
  return String(documentPath || '')
    .split('/')
    .filter(Boolean)
    .map(function(segment) {
      return encodeURIComponent(segment);
    })
    .join('/');
}

function buildDocumentUrl(documentPath, query) {
  const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(getProjectId()) + '/databases/(default)/documents';
  const url = new URL(base + '/' + encodeDocumentPath(documentPath));
  Object.entries(query || {}).forEach(function(entry) {
    const key = entry[0];
    const value = entry[1];
    if (Array.isArray(value)) {
      value.forEach(function(item) {
        url.searchParams.append(key, item);
      });
      return;
    }
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(function(item) {
          return toFirestoreValue(item);
        })
      }
    };
  }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: toFirestoreFields(value)
      }
    };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { nullValue: null };
    }
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }

  return { stringValue: String(value) };
}

export function toFirestoreFields(data) {
  const fields = {};
  Object.entries(data || {}).forEach(function(entry) {
    const key = entry[0];
    const value = entry[1];
    if (value !== undefined) {
      fields[key] = toFirestoreValue(value);
    }
  });
  return fields;
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if ('nullValue' in value) {
    return null;
  }
  if ('stringValue' in value) {
    return value.stringValue;
  }
  if ('booleanValue' in value) {
    return value.booleanValue;
  }
  if ('integerValue' in value) {
    return Number(value.integerValue);
  }
  if ('doubleValue' in value) {
    return Number(value.doubleValue);
  }
  if ('timestampValue' in value) {
    return value.timestampValue;
  }
  if ('mapValue' in value) {
    return decodeFields(value.mapValue.fields || {});
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(function(item) {
      return fromFirestoreValue(item);
    });
  }
  return null;
}

function decodeFields(fields) {
  const decoded = {};
  Object.entries(fields || {}).forEach(function(entry) {
    decoded[entry[0]] = fromFirestoreValue(entry[1]);
  });
  return decoded;
}

function decodeDocumentName(name) {
  const parts = String(name || '').split('/documents/');
  return parts[1] || '';
}

export function decodeDocument(document) {
  if (!document) {
    return null;
  }
  const documentPath = decodeDocumentName(document.name);
  const pathParts = documentPath.split('/').filter(Boolean);
  return {
    id: pathParts[pathParts.length - 1] || '',
    path: documentPath,
    data: decodeFields(document.fields || {}),
    createTime: document.createTime || null,
    updateTime: document.updateTime || null
  };
}

async function firestoreFetch(idToken, documentPath, options) {
  const opts = options || {};
  const response = await fetch(buildDocumentUrl(documentPath, opts.query), {
    method: opts.method || 'GET',
    headers: Object.assign({
      authorization: 'Bearer ' + idToken,
      'content-type': 'application/json; charset=utf-8'
    }, opts.headers || {}),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  if (response.ok) {
    if (response.status === 204) {
      return null;
    }
    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) : null;
  }

  const responseText = await response.text();
  const error = new Error('Firestore request failed with status ' + response.status);
  error.status = response.status;
  error.body = responseText;
  throw error;
}

export async function getDocument(idToken, documentPath) {
  try {
    const payload = await firestoreFetch(idToken, documentPath);
    return {
      exists: true,
      document: decodeDocument(payload)
    };
  } catch (firestoreError) {
    if (firestoreError.status === 404) {
      return {
        exists: false,
        document: null
      };
    }
    throw firestoreError;
  }
}

export async function patchDocument(idToken, documentPath, data, updateMask) {
  const payload = await firestoreFetch(idToken, documentPath, {
    method: 'PATCH',
    query: {
      'updateMask.fieldPaths': updateMask || Object.keys(data || {})
    },
    body: {
      fields: toFirestoreFields(data)
    }
  });

  return decodeDocument(payload);
}

export async function createDocument(idToken, collectionPath, data, documentId) {
  const payload = await firestoreFetch(idToken, collectionPath, {
    method: 'POST',
    query: documentId ? { documentId: documentId } : {},
    body: {
      fields: toFirestoreFields(data)
    }
  });

  return decodeDocument(payload);
}

export async function deleteDocument(idToken, documentPath) {
  await firestoreFetch(idToken, documentPath, {
    method: 'DELETE'
  });
  return true;
}


export async function queryCollectionByField(idToken, collectionId, fieldPath, value, parentPath) {
  const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(getProjectId()) + '/databases/(default)/documents';
  const parent = String(parentPath || '').trim();
  const url = base + (parent ? '/' + encodeDocumentPath(parent) : '') + ':runQuery';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + idToken,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: fieldPath },
            op: 'EQUAL',
            value: toFirestoreValue(value)
          }
        }
      }
    })
  });

  if (!response.ok) {
    const responseText = await response.text();
    const error = new Error('Firestore query failed with status ' + response.status);
    error.status = response.status;
    error.body = responseText;
    throw error;
  }

  const payload = await response.json();
  return (Array.isArray(payload) ? payload : []).map(function(entry) {
    return entry && entry.document ? decodeDocument(entry.document) : null;
  }).filter(Boolean);
}
