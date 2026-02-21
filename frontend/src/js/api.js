const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : '/api';

async function parseJsonOrThrow(res, fallbackMessage) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallbackMessage);
  }
  return res.json();
}

export async function listRaffles() {
  const res = await fetch(`${API_BASE}/raffles`);
  return parseJsonOrThrow(res, 'Error fetching raffles');
}

export async function getRaffle(id) {
  const res = await fetch(`${API_BASE}/raffles/${id}`);
  return parseJsonOrThrow(res, 'Error fetching raffle');
}

export async function createRaffle(data) {
  const res = await fetch(`${API_BASE}/raffles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseJsonOrThrow(res, 'Error creating raffle');
}

export async function buyTicket(raffleId, ticketData) {
  const res = await fetch(`${API_BASE}/raffles/${raffleId}/buy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData)
  });
  return parseJsonOrThrow(res, 'Error comprando boleta');
}

export async function registerSale(raffleId, saleData) {
  const res = await fetch(`${API_BASE}/raffles/${raffleId}/register-sale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData),
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error registrando venta');
}

export async function trackTicket(code) {
  const res = await fetch(`${API_BASE}/raffles/boleta/${encodeURIComponent(code)}`);
  if (res.status === 404) return { found: false };
  return parseJsonOrThrow(res, 'Error consultando boleta');
}

export async function drawWinner(raffleId) {
  const res = await fetch(`${API_BASE}/raffles/${raffleId}/draw`, { method: 'POST' });
  return parseJsonOrThrow(res, 'Error drawing winner');
}

export async function login(credentials) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error al iniciar sesion');
}

export async function logout() {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error al cerrar sesion');
}

export async function getAuthMe() {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  return parseJsonOrThrow(res, 'Error al verificar sesion');
}

export async function getAdminStats() {
  const res = await fetch(`${API_BASE}/raffles/admin/stats`, { credentials: 'include' });
  return parseJsonOrThrow(res, 'Error cargando estadisticas');
}

export async function listSellers() {
  const res = await fetch(`${API_BASE}/auth/users/sellers`, { credentials: 'include' });
  return parseJsonOrThrow(res, 'Error cargando vendedores');
}

export async function createSeller(data) {
  const res = await fetch(`${API_BASE}/auth/users/sellers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });
  return parseJsonOrThrow(res, 'Error creando vendedor');
}

export async function saveTicketToDB(code, userId, email, phone) {
  const res = await fetch(`${API_BASE}/raffles/boletas/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, userId, email, phone })
  });
  return parseJsonOrThrow(res, 'Error al guardar la boleta');
}

export async function getMyTicketsFromDB(userId) {
  const res = await fetch(`${API_BASE}/raffles/boletas/my/${encodeURIComponent(userId)}`);
  return parseJsonOrThrow(res, 'Error al obtener las boletas');
}

export async function removeSavedTicketFromDB(code, userId) {
  const res = await fetch(`${API_BASE}/raffles/boletas/${encodeURIComponent(code)}/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
  return parseJsonOrThrow(res, 'Error al eliminar la boleta');
}
