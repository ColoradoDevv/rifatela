import { API_BASE } from './config.js';

function isNetworkError(err) {
  return err?.name === 'TypeError' && (err.message === 'Failed to fetch' || err.message?.includes('fetch'));
}

async function parseJsonOrThrow(res, fallbackMessage) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallbackMessage);
  }
  return res.json();
}

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, credentials: options.credentials ?? 'same-origin' });
    return res;
  } catch (err) {
    if (isNetworkError(err)) {
      window.dispatchEvent(new CustomEvent('apiError', { detail: { type: 'network', message: 'No hay conexión con el servidor.' } }));
    }
    throw err;
  }
}

export async function listRaffles(opts = {}) {
  const params = new URLSearchParams();
  if (opts.page != null) params.set('page', String(opts.page));
  if (opts.limit != null) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const url = `${API_BASE}/raffles${qs ? `?${qs}` : ''}`;
  const res = await apiFetch(url);
  const data = await parseJsonOrThrow(res, 'Error fetching raffles');
  return data;
}

export async function getRaffle(id) {
  const res = await apiFetch(`${API_BASE}/raffles/${id}`);
  return parseJsonOrThrow(res, 'Error fetching raffle');
}

export async function createRaffle(data) {
  const res = await apiFetch(`${API_BASE}/raffles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseJsonOrThrow(res, 'Error creating raffle');
}

export async function buyTicket(raffleId, ticketData) {
  const res = await apiFetch(`${API_BASE}/raffles/${raffleId}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData)
  });
  return parseJsonOrThrow(res, 'Error comprando boleta');
}

export async function registerSale(raffleId, saleData) {
  const res = await apiFetch(`${API_BASE}/raffles/${raffleId}/register-sale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData),
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error registrando venta');
}

export async function trackTicket(code) {
  const res = await apiFetch(`${API_BASE}/raffles/boleta/${encodeURIComponent(code)}`);
  if (res.status === 404) return { found: false };
  const data = await parseJsonOrThrow(res, 'Error consultando boleta');
  const ticketsSold = data.participant ? (data.participants?.length ?? data.ticketsSold ?? 0) : 0;
  const totalTickets = data.totalTickets ?? 10000;
  const ticket = data.participant
    ? {
        ...data.participant,
        email: data.participant.email,
        phone: data.participant.phone,
        formattedDate: data.participant.boughtAt ? new Date(data.participant.boughtAt).toLocaleDateString('es-CO') : null
      }
    : null;
  const raffle = {
    ...data,
    ticketsSold: data.ticketsSold ?? ticketsSold,
    totalTickets,
    ticketsRemaining: totalTickets - (data.ticketsSold ?? ticketsSold),
    soldPercentage: totalTickets ? Math.round(((data.ticketsSold ?? ticketsSold) / totalTickets) * 100) : 0,
    isWinner: !!(data.winner && data.participant && data.winner.code === data.participant.code)
  };
  return { found: !!data.participant, raffle, ticket };
}

export async function drawWinner(raffleId) {
  const res = await apiFetch(`${API_BASE}/raffles/${raffleId}/draw`, { method: 'POST', credentials: 'include' });
  return parseJsonOrThrow(res, 'Error drawing winner');
}

export async function login(credentials) {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error al iniciar sesion');
}

export async function logout() {
  const res = await apiFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error al cerrar sesion');
}

export async function getAuthMe() {
  const res = await apiFetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  return parseJsonOrThrow(res, 'Error al verificar sesion');
}

export async function getAdminStats() {
  const res = await apiFetch(`${API_BASE}/raffles/admin/stats`, { credentials: 'include' });
  return parseJsonOrThrow(res, 'Error cargando estadisticas');
}

export async function listSellers() {
  const res = await apiFetch(`${API_BASE}/auth/users/sellers`, { credentials: 'include' });
  return parseJsonOrThrow(res, 'Error cargando vendedores');
}

export async function createSeller(data) {
  const res = await apiFetch(`${API_BASE}/auth/users/sellers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error creando vendedor');
}

export async function saveTicketToDB(code, userId, email, phone) {
  const res = await apiFetch(`${API_BASE}/raffles/boletas/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, userId, email, phone })
  });
  return parseJsonOrThrow(res, 'Error al guardar la boleta');
}

export async function getMyTicketsFromDB(userId) {
  const res = await apiFetch(`${API_BASE}/raffles/boletas/my/${encodeURIComponent(userId)}`);
  return parseJsonOrThrow(res, 'Error al obtener las boletas');
}

export async function removeSavedTicketFromDB(code, userId) {
  const res = await apiFetch(`${API_BASE}/raffles/boletas/${encodeURIComponent(code)}/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
  return parseJsonOrThrow(res, 'Error al eliminar la boleta');
}
