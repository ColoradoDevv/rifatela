import { getAuthMe } from '../api.js';
import { loadComponents } from '../utils/componentLoader.js';
import { initHeader } from '../components/header.js';

function parseAllowedRoles() {
  const raw = document.body?.dataset?.allowedRoles;
  if (!raw) return [];
  return raw.split(',').map((r) => r.trim()).filter(Boolean);
}

async function checkAuth() {
  const loadingScreen = document.getElementById('auth-check-loading');
  const protectedContent = document.getElementById('protected-content');

  try {
    const response = await getAuthMe();
    if (!response || !response.success || !response.user) {
      return redirectToLogin();
    }

    const allowedRoles = parseAllowedRoles();
    if (allowedRoles.length > 0 && !allowedRoles.includes(response.user.role)) {
      return redirectByRole(response.user.role);
    }

    await loadComponents();
    document.addEventListener('componentLoaded', (e) => {
      if (e.detail.selector === '.header-container') {
        initHeader(e.detail.container);
      }
    });

    if (loadingScreen) loadingScreen.style.display = 'none';
    if (protectedContent) protectedContent.style.display = 'block';

    document.dispatchEvent(new CustomEvent('authVerified', {
      detail: { user: response.user }
    }));
  } catch (_error) {
    redirectToLogin();
  }
}

function redirectByRole(role) {
  if (role === 'admin') {
    window.location.replace('/admin');
    return;
  }
  if (role === 'seller') {
    window.location.replace('/ventas');
    return;
  }
  redirectToLogin();
}

function redirectToLogin() {
  const currentPath = window.location.pathname;
  const redirectUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
  window.location.replace(redirectUrl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAuth);
} else {
  checkAuth();
}
