function mergeHeaders(base, extra) {
  const headers = new Headers(base || {});
  Object.entries(extra || {}).forEach(function(entry) {
    const key = entry[0];
    const value = entry[1];
    if (value !== undefined && value !== null) {
      headers.set(key, String(value));
    }
  });
  return headers;
}

export function json(payload, options) {
  const opts = options || {};
  const headers = mergeHeaders({
    'content-type': 'application/json; charset=utf-8'
  }, opts.headers);

  return new Response(JSON.stringify(payload), {
    status: opts.status || 200,
    headers: headers
  });
}

export function error(status, code, message, details, headers) {
  const payload = {
    ok: false,
    error: {
      code: code,
      message: message
    }
  };

  if (details && Object.keys(details).length) {
    payload.error.details = details;
  }

  return json(payload, {
    status: status,
    headers: headers
  });
}

export function methodNotAllowed(allowedMethods) {
  return error(405, 'method_not_allowed', 'Method not allowed', {
    allowedMethods: allowedMethods
  }, {
    allow: allowedMethods.join(', ')
  });
}

export function nodeHeadersToWebHeaders(headers) {
  const normalized = new Headers();
  Object.entries(headers || {}).forEach(function(entry) {
    const key = entry[0];
    const value = entry[1];
    if (Array.isArray(value)) {
      normalized.set(key, value.join(', '));
    } else if (value !== undefined && value !== null) {
      normalized.set(key, String(value));
    }
  });
  return normalized;
}

export function nodeRequestBodyToString(req) {
  if (!req || req.method === 'GET' || req.method === 'HEAD') {
    return '';
  }
  if (typeof req.body === 'string') {
    return req.body;
  }
  if (req.body == null) {
    return '';
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString('utf8');
  }
  return JSON.stringify(req.body);
}

export async function sendNodeResponse(webResponse, res) {
  webResponse.headers.forEach(function(value, key) {
    res.setHeader(key, value);
  });
  res.statusCode = webResponse.status;
  const body = Buffer.from(await webResponse.arrayBuffer());
  res.end(body);
}
