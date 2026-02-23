/**
 * Environment variable validation and app config.
 */
require('dotenv').config();

const required = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error('ERROR: Missing required environment variables:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('\nCreate a .env file with the required variables. In production JWT_SECRET must be random and secure.');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * CORS origins. Accepts:
 * - true / "true" to allow any origin
 * - comma-separated list of origins
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

/** Environment: development | production */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Auth cookie settings:
 * - COOKIE_SECURE: true/false (default true in production)
 * - COOKIE_SAMESITE: lax | strict | none
 * - COOKIE_DOMAIN: optional cookie domain
 */
const COOKIE_SECURE = process.env.COOKIE_SECURE;
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || '';

module.exports = {
  JWT_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CORS_ORIGIN,
  NODE_ENV,
  COOKIE_SECURE,
  COOKIE_SAMESITE,
  COOKIE_DOMAIN
};
