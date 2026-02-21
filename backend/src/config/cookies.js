const {
  NODE_ENV,
  COOKIE_SECURE,
  COOKIE_SAMESITE,
  COOKIE_DOMAIN
} = require('./env');

function parseBoolean(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

const parsedSecure = parseBoolean(COOKIE_SECURE);
const secure = parsedSecure == null ? NODE_ENV === 'production' : parsedSecure;
const sameSite = (COOKIE_SAMESITE || (secure ? 'none' : 'lax')).toLowerCase();

if (sameSite === 'none' && !secure) {
  console.warn('COOKIE_SAMESITE=none requires secure cookies. Forcing secure=true.');
}

const effectiveSecure = sameSite === 'none' ? true : secure;

const baseAuthCookieOptions = {
  httpOnly: true,
  secure: effectiveSecure,
  sameSite,
  path: '/'
};

if (COOKIE_DOMAIN) {
  baseAuthCookieOptions.domain = COOKIE_DOMAIN;
}

function buildAuthCookieOptions(maxAge) {
  if (typeof maxAge === 'number') {
    return { ...baseAuthCookieOptions, maxAge };
  }
  return { ...baseAuthCookieOptions };
}

module.exports = {
  buildAuthCookieOptions
};
