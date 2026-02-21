/**
 * Frontend runtime configuration.
 * API base options:
 * - Default: /api (recommended with Vercel proxy to Railway).
 * - Override at runtime: window.APP_API_BASE = 'https://.../api'
 * - Bundlers (e.g. Vite): VITE_API_BASE
 */
function getApiBase() {
  if (typeof window !== 'undefined' && window.APP_API_BASE != null && window.APP_API_BASE !== '') {
    return window.APP_API_BASE.replace(/\/$/, '');
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    return String(import.meta.env.VITE_API_BASE).replace(/\/$/, '');
  }
  return '/api';
}

/** Base URL for API calls (without trailing slash). */
export const API_BASE = getApiBase();

/**
 * Frontend base path (up to and including /src/) for resolving resources.
 * Used by componentLoader for absolute paths from site root.
 */
export function getFrontendBasePath() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const idx = pathname.indexOf('/src/');
  if (idx !== -1) {
    const base = pathname.slice(0, idx + 5);
    return base.endsWith('/') ? base : `${base}/`;
  }
  if (pathname.endsWith('/') || pathname === '') {
    return pathname || '/';
  }
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 0 ? `/${parts.slice(0, -1).join('/')}/` : '/';
}
