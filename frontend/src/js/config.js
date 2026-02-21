/**
 * Punto único de configuración del frontend.
 * Para producción o desarrollo con API en otra URL, definir window.APP_API_BASE
 * antes de cargar los scripts (ej. en index.html: <script>window.APP_API_BASE='/api';</script>).
 * Con build (Vite): usar variable de entorno VITE_API_BASE.
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

/** Base URL para las llamadas a la API (sin barra final). */
export const API_BASE = getApiBase();

/**
 * Base path del frontend (hasta y incluyendo /src/) para resolver recursos.
 * Se usa en componentLoader para rutas absolutas desde la raíz del sitio.
 */
export function getFrontendBasePath() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const idx = pathname.indexOf('/src/');
  if (idx !== -1) {
    const base = pathname.slice(0, idx + 5);
    return base.endsWith('/') ? base : base + '/';
  }
  if (pathname.endsWith('/') || pathname === '') {
    return pathname || '/';
  }
  const parts = pathname.split('/').filter(Boolean);
  return parts.length > 0 ? '/' + parts.slice(0, -1).join('/') + '/' : '/';
}
