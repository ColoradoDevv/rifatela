import { loadComponents } from './utils/componentLoader.js';
import { initHeroCarousel } from './features/carousel.js';
import { initHeader, saveTicket } from './components/header.js';
import { listRaffles, createRaffle, buyTicket, drawWinner, trackTicket } from './api.js';

const listEl = document.getElementById('list');
const form = document.getElementById('raffle-form');

// --- RECOGNITION AND INITIALIZATION ---

// Start initializing when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function initApp() {
  // Load all structural components (Header, Hero (main), etc.)
  loadComponents();

  // If we have a raffle list element on this page, load the data
  if (listEl) loadRaffles();
}

// Logic to run after a component (like Header or Hero) is injected into the page
document.addEventListener("componentLoaded", (e) => {
  if (e.detail.selector === ".header-container") {
    initHeader(e.detail.container);
  }

  if (e.detail.selector === ".hero-container") {
    console.log("Hero component injected, initializing features...");
    initHeroTracking(e.detail.container);
    initHeroCarousel(e.detail.container);
  }
});

// --- API DATA LOADING ---

async function loadRaffles() {
  try {
    const raffles = await listRaffles();
    renderList(raffles);
  } catch (e) {
    console.error("API error:", e);
    if (listEl) listEl.innerHTML = `<li class="error">Error de API: Verifica la conexión al servidor.</li>`;
  }
}

function renderList(raffles) {
  if (!listEl) return;
  if (!Array.isArray(raffles) || raffles.length === 0) {
    listEl.innerHTML = '<li>No hay rifas disponibles en este momento.</li>';
    return;
  }
  listEl.innerHTML = '';
  raffles.forEach(r => {
    const li = document.createElement('li');
    li.className = 'raffle-item';
    li.innerHTML = `
      <h3>${escapeHtml(r.title)}</h3>
      <p>${escapeHtml(r.description || '')}</p>
      <div class="raffle-info">
        <span>Precio: $${r.pricePerTicket}</span>
        <span>${r.ticketsSold}/${r.totalTickets || '∞'} vendidos</span>
      </div>
      <div class="raffle-actions">
        <button data-id="${r._id}" class="buy-btn">Comprar</button>
        <button data-id="${r._id}" class="draw-btn">Sortear</button>
      </div>
    `;
    listEl.appendChild(li);
  });
}

// --- GLOBAL EVENT LISTENERS ---

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {
      title: fd.get('title'),
      description: fd.get('description'),
      pricePerTicket: Number(fd.get('pricePerTicket') || 0),
      totalTickets: Number(fd.get('totalTickets') || 0)
    };
    try {
      await createRaffle(data);
      form.reset();
      await loadRaffles();
    } catch (err) {
      alert("Error al crear la rifa: " + err.message);
    }
  });
}

if (listEl) {
  listEl.addEventListener('click', async (e) => {
    const buyBtn = e.target.closest('.buy-btn');
    const drawBtn = e.target.closest('.draw-btn');

    if (buyBtn) {
      const id = buyBtn.dataset.id;
      const name = prompt('Ingresa tu nombre completo:');
      const email = prompt('Ingresa tu correo electrónico:');
      if (!name || !email) return;
      try {
        const res = await buyTicket(id, { name, email });
        alert('¡Compra exitosa! Tu boleta es: #' + formatTicketNumber(res.ticketNumber));
        await loadRaffles();
      } catch (err) {
        alert("Error en la compra: " + err.message);
      }
    } else if (drawBtn) {
      const id = drawBtn.dataset.id;
      if (!confirm('¿Seguro que quieres realizar el sorteo ahora?')) return;
      try {
        const res = await drawWinner(id);
        alert('¡Tenemos un ganador! Felicitaciones a: ' + (res.winner?.name || "Ganador no encontrado"));
      } catch (err) {
        alert("Error en el sorteo: " + err.message);
      }
    }
  });
}

// --- HERO TRACKING FEATURE ---

function initHeroTracking(container) {
  const form = container.querySelector("#tracking-form");
  const resultDiv = container.querySelector("#tracking-result");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codeInput = container.querySelector("#boleta-code");
    const code = codeInput.value.trim().toUpperCase();

    if (!code) return;

    // Show loading state
    resultDiv.style.display = "block";
    resultDiv.innerHTML = `
        <div style="text-align: center; color: rgba(255,255,255,0.7); padding: 1rem;">
            <p>🔍 Buscando boleta: <strong>${escapeHtml(code)}</strong>...</p>
        </div>`;

    try {
      const data = await trackTicket(code);

      if (data.found) {
        // Save ticket to MongoDB for "Mis Tickets"
        saveTicket({
          code: data.ticket.code,
          ticketNumber: data.ticket.ticketNumber,
          raffleTitle: data.raffle.title,
          name: data.ticket.name,
          email: data.ticket.email || null,
          phone: data.ticket.phone || null,
          boughtAt: data.ticket.boughtAt
        });
        
        const statusBadge = data.raffle.status === 'active'
          ? '<div style="margin-top: 0.75rem; display: inline-block; background: #22c55e; color: white; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">ACTIVO</div>'
          : data.raffle.isWinner
            ? '<div style="margin-top: 0.75rem; display: inline-block; background: #ffd700; color: #1a1a2e; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">🏆 ¡GANADOR!</div>'
            : '<div style="margin-top: 0.75rem; display: inline-block; background: #64748b; color: white; padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">COMPLETADA</div>';

        // Información del premio
        const prizeInfo = data.raffle.prize 
          ? `<div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255, 215, 0, 0.1); border-left: 3px solid #ffd700; border-radius: 8px;">
              <p style="font-size: 0.85rem; font-weight: 700; color: #ffd700; margin-bottom: 0.25rem;">🎁 Premio:</p>
              <p style="font-size: 0.9rem; color: rgba(255,255,255,0.9);">${escapeHtml(data.raffle.prize)}</p>
            </div>`
          : '';

        // Información de progreso de la rifa
        const progressInfo = data.raffle.totalTickets > 0
          ? `<div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.85rem; color: rgba(255,255,255,0.7);">Progreso de ventas:</span>
                <span style="font-size: 0.85rem; font-weight: 700; color: #ffd700;">${data.raffle.soldPercentage}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
                <div style="width: ${data.raffle.soldPercentage}%; height: 100%; background: linear-gradient(90deg, #22c55e, #10b981); transition: width 0.3s ease;"></div>
              </div>
              <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-top: 0.5rem;">
                ${data.raffle.ticketsSold} de ${data.raffle.totalTickets} boletas vendidas
                ${data.raffle.ticketsRemaining > 0 ? `(${data.raffle.ticketsRemaining} disponibles)` : ''}
              </p>
            </div>`
          : '';

        // Información de fecha de compra
        const dateInfo = data.ticket.formattedDate
          ? `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
              <p style="font-size: 0.8rem; color: rgba(255,255,255,0.6);">
                📅 Comprado el: <strong style="color: rgba(255,255,255,0.9);">${escapeHtml(data.ticket.formattedDate)}</strong>
              </p>
            </div>`
          : '';

        resultDiv.innerHTML = `
            <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; color: #86efac; padding: 1.5rem; border-radius: 16px; animation: text-reveal 0.5s ease;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                    <div style="font-size: 1.5rem;">✅</div>
                    <p style="font-weight: 800; font-size: 1.2rem; margin: 0;">¡Boleta Verificada!</p>
                </div>
                
                <div style="background: rgba(255, 255, 255, 0.05); padding: 1rem; border-radius: 12px; margin-bottom: 1rem;">
                    <p style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">
                        <strong style="color: #ffd700;">Rifa:</strong> ${escapeHtml(data.raffle.title)}
                    </p>
                    <p style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">
                        <strong style="color: #ffd700;">Código:</strong> <span style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 4px;">${escapeHtml(data.ticket.code)}</span>
                    </p>
                    <p style="font-size: 0.9rem; opacity: 0.9;">
                        <strong style="color: #ffd700;">Boleta #${formatTicketNumber(data.ticket.ticketNumber)}</strong>
                    </p>
                </div>
                
                ${prizeInfo}
                ${progressInfo}
                ${dateInfo}
                
                <div style="margin-top: 1rem; text-align: center;">
                    ${statusBadge}
                </div>
                
                ${data.raffle.isWinner ? `
                    <div style="margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 193, 7, 0.2)); border: 2px solid #ffd700; border-radius: 12px; text-align: center;">
                        <p style="font-size: 1.1rem; font-weight: 800; color: #ffd700; margin: 0;">🎉 ¡FELICITACIONES! 🎉</p>
                        <p style="font-size: 0.9rem; color: rgba(255,255,255,0.9); margin-top: 0.5rem;">Eres el ganador de esta rifa</p>
                    </div>
                ` : ''}
            </div>`;
      } else {
        resultDiv.innerHTML = `
            <div style="background: rgba(196, 12, 12, 0.1); border: 1px solid rgba(196, 12, 12, 0.3); color: #fca5a5; padding: 1.25rem; border-radius: 16px; animation: text-reveal 0.5s ease;">
                <p style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.5rem;">❌ Código No Encontrado</p>
                <p style="font-size: 0.9rem; opacity: 0.9;">No pudimos encontrar la boleta <strong>${escapeHtml(code)}</strong>. Verifica el código e intenta nuevamente.</p>
            </div>`;
      }
    } catch (err) {
      resultDiv.innerHTML = `
          <div style="background: rgba(196, 12, 12, 0.1); border: 1px solid rgba(196, 12, 12, 0.3); color: #fca5a5; padding: 1.25rem; border-radius: 16px; animation: text-reveal 0.5s ease;">
              <p style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.5rem;">⚠️ Error de Conexión</p>
              <p style="font-size: 0.9rem; opacity: 0.9;">No se pudo conectar con el servidor. Intenta de nuevo más tarde.</p>
          </div>`;
    }
  });
}

// --- UTILS ---

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => {
    return '&#' + c.charCodeAt(0) + ';';
  });
}

function formatTicketNumber(ticketNumber) {
  return String(ticketNumber).padStart(4, '0');
}
