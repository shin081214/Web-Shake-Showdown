function firstHeaderValue(value) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0].trim();
}

function normalizeOrigin(origin) {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(value = '') {
  return value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
    .map(origin => origin === '*' ? origin : normalizeOrigin(origin))
    .filter(Boolean);
}

function getRequestOrigin(request) {
  const protocol =
    firstHeaderValue(request.headers['x-forwarded-proto']) ||
    (request.socket?.encrypted ? 'https' : 'http');
  const host =
    firstHeaderValue(request.headers['x-forwarded-host']) ||
    firstHeaderValue(request.headers.host);

  return host ? normalizeOrigin(`${protocol}://${host}`) : null;
}

function createSocketRequestAuthorizer({
  environment = process.env.NODE_ENV,
  allowedOrigins = process.env.SOCKET_ALLOWED_ORIGINS,
} = {}) {
  const configuredOrigins = new Set(parseAllowedOrigins(allowedOrigins));
  const allowsAnyOrigin = configuredOrigins.has('*');
  const isDevelopment = environment !== 'production';

  return (request, callback) => {
    const suppliedOrigin = firstHeaderValue(request.headers.origin);
    if (!suppliedOrigin || isDevelopment || allowsAnyOrigin) {
      callback(null, true);
      return;
    }

    const origin = normalizeOrigin(suppliedOrigin);
    const requestOrigin = getRequestOrigin(request);
    const isAllowed =
      origin !== null &&
      (origin === requestOrigin || configuredOrigins.has(origin));

    callback(null, isAllowed);
  };
}

module.exports = {
  createSocketRequestAuthorizer,
  parseAllowedOrigins,
};
