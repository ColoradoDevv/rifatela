import { listRaffles, registerSale, getRaffle, logout } from '../api.js';

function waitForAuth() {
  const protectedContent = document.getElementById('protected-content');
  if (protectedContent && protectedContent.style.display !== 'none') {
    initSellerForm();
    return;
  }

  document.addEventListener('authVerified', () => {
    initSellerForm();
  }, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForAuth);
} else {
  waitForAuth();
}

let currentRaffle = null;
let occupiedTickets = [];
const MIN_TICKET = 0;
const MAX_TICKET = 9999;

async function initSellerForm() {
  const form = document.getElementById('register-sale-form');
  const raffleSelect = document.getElementById('raffle-select');
  const ticketNumberInput = document.getElementById('ticket-number');
  const submitBtn = document.getElementById('submit-btn');
  const errorDiv = document.getElementById('form-error');
  const resultDiv = document.getElementById('sale-result');

  if (!form) return;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await logout();
      } catch (_) {}
      window.location.href = '/login';
    });
  }

  await loadRaffles();

  raffleSelect.addEventListener('change', async (e) => {
    const raffleId = e.target.value;
    if (raffleId) {
      await loadRaffleDetails(raffleId);
    } else {
      currentRaffle = null;
      occupiedTickets = [];
      updateTicketStatus();
    }
  });

  ticketNumberInput.addEventListener('input', (e) => {
    e.target.value = String(e.target.value || '').replace(/\D/g, '').slice(0, 4);
    const ticketNum = parseInt(e.target.value, 10);
    if (ticketNum && currentRaffle) {
      checkTicketAvailability(ticketNum);
    } else {
      updateTicketStatus();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const raffleId = formData.get('raffleId');
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const rawTicket = String(formData.get('ticketNumber') || '').trim();
    const ticketNumber = parseInt(rawTicket, 10);
    const paymentMethod = formData.get('paymentMethod');

    hideError();
    resultDiv.style.display = 'none';

    if (!raffleId) {
      showError('Selecciona una rifa');
      return;
    }

    if (!name || !email || !phone) {
      showError('Completa todos los campos del cliente');
      return;
    }

    if (!/^\d{4}$/.test(rawTicket)) {
      showError('La boleta debe tener exactamente 4 digitos (0000-9999)');
      return;
    }

    if (!Number.isInteger(ticketNumber) || ticketNumber < MIN_TICKET || ticketNumber > MAX_TICKET) {
      showError('La boleta debe estar entre 0000 y 9999');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Ingresa un correo electronico valido');
      return;
    }

    if (occupiedTickets.includes(ticketNumber)) {
      showError(`La boleta #${formatTicketNumber(ticketNumber)} ya esta ocupada`);
      return;
    }

    setLoadingState(true);

    try {
      const response = await registerSale(raffleId, {
        name,
        email,
        phone,
        ticketNumber: rawTicket,
        paymentMethod
      });

      showSuccessResult(response, { name, ticketNumber: response.ticketNumber || ticketNumber, ticketNumberFormatted: response.ticketNumberFormatted || formatTicketNumber(ticketNumber) });
      form.reset();
      currentRaffle = null;
      occupiedTickets = [];
      updateTicketStatus();
      await loadRaffles();
    } catch (error) {
      showError(error.message || 'Error al registrar la venta');
    } finally {
      setLoadingState(false);
    }
  });

  function setLoadingState(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.classList.add('admin-form__submit--loading');
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove('admin-form__submit--loading');
    }
  }

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('admin-form__error--show');
  }

  function hideError() {
    errorDiv.classList.remove('admin-form__error--show');
    errorDiv.textContent = '';
  }

  function showSuccessResult(response, saleData) {
    resultDiv.innerHTML = `
      <div class="admin-form__result-title">Venta registrada</div>
      <div class="admin-form__result-info">
        <div class="admin-form__result-item">
          <span class="admin-form__result-label">Codigo:</span>
          <span class="admin-form__result-code">${escapeHtml(response.code)}</span>
        </div>
        <div class="admin-form__result-item">
          <span class="admin-form__result-label">Cliente:</span>
          <span class="admin-form__result-value">${escapeHtml(saleData.name)}</span>
        </div>
        <div class="admin-form__result-item">
          <span class="admin-form__result-label">Boleta:</span>
          <span class="admin-form__result-value">#${saleData.ticketNumberFormatted}</span>
        </div>
        <div class="admin-form__result-item">
          <span class="admin-form__result-label">Rifa:</span>
          <span class="admin-form__result-value">${escapeHtml(response.raffleName)}</span>
        </div>
      </div>
    `;

    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function loadRaffles() {
  const raffleSelect = document.getElementById('raffle-select');

  try {
    const raffles = await listRaffles();
    const activeRaffles = raffles.filter((r) => r.status === 'active');

    raffleSelect.innerHTML = '<option value="">Selecciona una rifa...</option>';

    if (activeRaffles.length === 0) {
      raffleSelect.innerHTML = '<option value="">No hay rifas activas</option>';
      raffleSelect.disabled = true;
      return;
    }

    raffleSelect.disabled = false;
    activeRaffles.forEach((raffle) => {
      const option = document.createElement('option');
      option.value = raffle._id;
      option.textContent = raffle.title;
      raffleSelect.appendChild(option);
    });
  } catch (_error) {
    raffleSelect.innerHTML = '<option value="">Error al cargar rifas</option>';
  }
}

async function loadRaffleDetails(raffleId) {
  try {
    currentRaffle = await getRaffle(raffleId);
    occupiedTickets = (currentRaffle.participants || []).map((p) => p.ticketNumber);

    const raffleInfo = document.getElementById('raffle-info');
    const sold = occupiedTickets.length;
    const total = MAX_TICKET + 1;
    const ticketsRemaining = total - sold;

    raffleInfo.innerHTML = `
      <strong>Premio:</strong> ${escapeHtml(currentRaffle.prize || 'No especificado')}<br>
      <strong>Boletas vendidas:</strong> ${sold} / ${total || 'N/A'}<br>
      <strong>Disponibles:</strong> ${ticketsRemaining}
    `;
    raffleInfo.style.display = 'block';

    const ticketNumberInput = document.getElementById('ticket-number');
    ticketNumberInput.maxLength = 4;

    updateTicketStatus();
  } catch (_error) {}
}

function checkTicketAvailability(ticketNumber) {
  const ticketStatus = document.getElementById('ticket-status');

  if (occupiedTickets.includes(ticketNumber)) {
    ticketStatus.innerHTML = `<div class="ticket-status__occupied">La boleta #${formatTicketNumber(ticketNumber)} ya esta ocupada</div>`;
  } else if (ticketNumber > MAX_TICKET) {
    ticketStatus.innerHTML = `<div class="ticket-status__occupied">El numero excede el total disponible</div>`;
  } else {
    ticketStatus.innerHTML = `<div class="ticket-status__available">La boleta #${formatTicketNumber(ticketNumber)} esta disponible</div>`;
  }
}

function updateTicketStatus() {
  const ticketStatus = document.getElementById('ticket-status');
  const ticketNumberInput = document.getElementById('ticket-number');

  if (!currentRaffle) {
    ticketStatus.innerHTML = '';
    return;
  }

  const ticketNum = parseInt(ticketNumberInput.value, 10);
  if (ticketNum) {
    checkTicketAvailability(ticketNum);
  } else {
    ticketStatus.innerHTML = '<p style="color: rgba(255,255,255,0.7);">Ingresa el numero elegido por el cliente</p>';
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatTicketNumber(value) {
  return String(value).padStart(4, '0');
}
