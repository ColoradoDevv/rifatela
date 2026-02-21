import { createSeller, listSellers, logout } from '../api.js';

let adminUserName = 'Admin';
let knownSellerUsernames = new Set();

function waitForAuth() {
  const protectedContent = document.getElementById('protected-content');
  if (protectedContent && protectedContent.style.display !== 'none') {
    initSellersPage();
    return;
  }

  document.addEventListener('authVerified', (e) => {
    adminUserName = e.detail?.user?.username || 'Admin';
    initSellersPage();
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForAuth);
} else {
  waitForAuth();
}

async function initSellersPage() {
  setText('dashboard-username', adminUserName);
  bindLogout();
  bindSellerForm();
  await renderSellers();
}

function bindLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await logout();
    } catch (_) {}
    window.location.href = '/login';
  });
}

function bindSellerForm() {
  const form = document.getElementById('create-seller-form');
  const error = document.getElementById('seller-form-error');
  const success = document.getElementById('seller-form-success');
  const usernameInput = document.getElementById('seller-username');
  const passwordInput = document.getElementById('seller-password');
  const randomBtn = document.getElementById('generate-random-credentials');
  const togglePasswordBtn = document.getElementById('toggle-seller-password');

  if (!form) return;

  if (randomBtn && usernameInput && passwordInput) {
    randomBtn.addEventListener('click', () => {
      const username = buildUniqueSellerUsername(usernameInput.value);
      const password = randomPassword(12);
      usernameInput.value = username;
      passwordInput.value = password;
      success.textContent = 'Credenciales aleatorias generadas. Puedes editarlas antes de guardar.';
      error.textContent = '';
    });
  }

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.setAttribute('aria-label', isPassword ? 'Ocultar contrasena' : 'Mostrar u ocultar contrasena');
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    success.textContent = '';

    const formData = new FormData(form);
    const username = String(formData.get('username') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();

    if (!username || !password) {
      error.textContent = 'Usuario y contrasena son obligatorios';
      return;
    }

    try {
      await createSeller({ username, email, password });
      success.textContent = 'Vendedor creado correctamente';
      form.reset();
      await renderSellers();
    } catch (err) {
      error.textContent = err.message || 'No se pudo crear el vendedor';
      if ((err.message || '').toLowerCase().includes('ya existe un usuario')) {
        await renderSellers();
        const suggested = buildUniqueSellerUsername(username);
        if (usernameInput) usernameInput.value = suggested;
        success.textContent = `Sugerencia: prueba con ${suggested}`;
      }
    }
  });
}

function buildUniqueSellerUsername(currentValue = '') {
  const blocked = new Set(knownSellerUsernames);
  const currentNormalized = normalizeUsername(currentValue);
  if (currentNormalized) blocked.add(currentNormalized);
  return generateSellerUsername(blocked);
}

function generateSellerUsername(blockedUsernames = new Set()) {
  const blocked = new Set(Array.from(blockedUsernames).map(normalizeUsername).filter(Boolean));

  for (let i = 0; i < 30; i++) {
    const base36 = Date.now().toString(36).slice(-3);
    const candidate = `vendedor_${base36}${randomToken(6).toLowerCase()}`;
    if (!blocked.has(normalizeUsername(candidate))) {
      return candidate;
    }
  }

  return `vendedor_${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function randomToken(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomPassword(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function renderSellers() {
  const tbody = document.getElementById('sellers-table-body');
  if (!tbody) return;

  try {
    const response = await listSellers();
    const sellers = response.sellers || [];
    knownSellerUsernames = new Set(sellers.map((seller) => normalizeUsername(seller.username)).filter(Boolean));

    if (sellers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">No hay vendedores registrados</td></tr>';
      return;
    }

    tbody.innerHTML = sellers.map((seller) => `
      <tr>
        <td>${escapeHtml(seller.username)}</td>
        <td>${escapeHtml(seller.email || '-')}</td>
        <td>${formatDate(seller.createdAt)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3">${escapeHtml(err.message || 'Error')}</td></tr>`;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO');
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
