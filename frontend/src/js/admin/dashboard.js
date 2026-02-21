import { getAdminStats, logout } from '../api.js';

let dashboardUserName = 'Admin';
let statsRefreshInterval = null;

function waitForAuth() {
  const protectedContent = document.getElementById('protected-content');
  if (protectedContent && protectedContent.style.display !== 'none') {
    initDashboard();
    return;
  }

  document.addEventListener('authVerified', (e) => {
    dashboardUserName = e.detail?.user?.username || 'Admin';
    initDashboard();
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForAuth);
} else {
  waitForAuth();
}

async function initDashboard() {
  setText('dashboard-username', dashboardUserName);
  bindLogout();
  await renderStats();
  startAutoRefresh();
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

function startAutoRefresh() {
  if (statsRefreshInterval) clearInterval(statsRefreshInterval);

  statsRefreshInterval = setInterval(() => {
    if (document.hidden) return;
    renderStats();
  }, 30000);
}

async function renderStats() {
  try {
    const response = await getAdminStats();
    const stats = response.stats || {};

    setText('stat-total-raffles', stats.totalRaffles || 0);
    setText('stat-active-raffles', stats.activeRaffles || 0);
    setText('stat-total-sales', stats.totalTicketsSold || 0);
    setText('stat-revenue', formatCurrency(stats.grossRevenue || 0));

    renderTopRaffles(response.topRaffles || []);
    renderSellerRanking(response.sellerRanking || []);
    renderRecentSales(response.recentSales || []);
    renderRevenueChart(response.monthlyRevenueSeries || []);
  } catch (err) {
    const errorBox = document.getElementById('dashboard-error');
    if (errorBox) errorBox.textContent = err.message || 'Error cargando dashboard';
  }
}

function renderRevenueChart(series) {
  const lineEl = document.getElementById('revenue-line');
  const areaEl = document.getElementById('revenue-area');
  const pointsEl = document.getElementById('revenue-points');
  const labelsEl = document.getElementById('revenue-chart-labels');
  if (!lineEl || !areaEl || !pointsEl || !labelsEl) return;

  if (!Array.isArray(series) || series.length === 0) {
    lineEl.setAttribute('d', '');
    areaEl.setAttribute('d', '');
    pointsEl.innerHTML = '';
    labelsEl.innerHTML = '';
    return;
  }

  const width = 720;
  const height = 280;
  const pad = { top: 18, right: 16, bottom: 24, left: 16 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const maxRevenue = Math.max(...series.map((s) => Number(s.revenue || 0)), 1);

  const points = series.map((item, index) => {
    const x = pad.left + (index * chartW) / Math.max(series.length - 1, 1);
    const y = pad.top + chartH - ((Number(item.revenue || 0) / maxRevenue) * chartH);
    return { x, y, item };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(pad.top + chartH).toFixed(2)} L ${points[0].x.toFixed(2)} ${(pad.top + chartH).toFixed(2)} Z`;

  lineEl.setAttribute('d', linePath);
  areaEl.setAttribute('d', areaPath);

  pointsEl.innerHTML = points.map((p) => `
    <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.5" fill="#f6ce71">
      <title>${p.item.label}: ${formatCurrency(p.item.revenue || 0)} (${p.item.sales || 0} ventas)</title>
    </circle>
  `).join('');

  const containerWidth = labelsEl.clientWidth || 0;
  let step = 1;
  if (containerWidth < 760) step = 2;
  if (containerWidth < 520) step = 3;

  labelsEl.innerHTML = series.map((s, index) => {
    const raw = String(s.label || '');
    const shortLabel = raw.replace(' de ', '/').replace('sept', 'sep');
    const shouldShow = index === 0 || index === series.length - 1 || index % step === 0;
    const className = shouldShow ? 'dashboard-chart__label' : 'dashboard-chart__label dashboard-chart__label--hidden';
    const value = shouldShow ? shortLabel : '.';
    return `<span class="${className}">${escapeHtml(value)}</span>`;
  }).join('');
}

function renderTopRaffles(items) {
  const list = document.getElementById('top-raffles-list');
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = '<li>Sin datos</li>';
    return;
  }

  list.innerHTML = items.map((item) => (
    `<li>${escapeHtml(item.title)}: ${item.ticketsSold} boletas</li>`
  )).join('');
}

function renderSellerRanking(items) {
  const list = document.getElementById('seller-ranking-list');
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = '<li>Sin ventas registradas</li>';
    return;
  }

  list.innerHTML = items.map((item) => (
    `<li>${escapeHtml(item.seller)}: ${item.sales} ventas</li>`
  )).join('');
}

function renderRecentSales(items) {
  const tbody = document.getElementById('recent-sales-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Sin ventas recientes</td></tr>';
    return;
  }

  tbody.innerHTML = items.map((sale) => `
    <tr>
      <td>${escapeHtml(sale.code || '-')}</td>
      <td>${escapeHtml(sale.raffleTitle || '-')}</td>
      <td>${escapeHtml(sale.buyerName || '-')}</td>
      <td>${escapeHtml(sale.registeredBy || '-')}</td>
      <td>${formatDate(sale.boughtAt)}</td>
    </tr>
  `).join('');
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
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

window.addEventListener('beforeunload', () => {
  if (statsRefreshInterval) clearInterval(statsRefreshInterval);
});
