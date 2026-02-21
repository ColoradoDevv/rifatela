import { getMyTicketsFromDB, removeSavedTicketFromDB } from '../api.js';

const STORAGE_KEY = 'rifatela_userSecret';

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/** Obtiene o crea el userSecret (UUID) para "Mis boletas". Solo el cliente que tiene este valor puede ver/borrar sus boletas. */
function getUserSecret() {
    let secret = localStorage.getItem(STORAGE_KEY);
    if (!secret) {
        secret = generateUUID();
        localStorage.setItem(STORAGE_KEY, secret);
    }
    return secret;
}

/**
 * Initializes the Header component functionality.
 * @param {HTMLElement} container - The container element for the Header component.
 */
export function initHeader(container) {
    const hamburger = container.querySelector(".header__hamburger");
    const navLinks = container.querySelectorAll(".header__nav-item");

    if (!hamburger) return;

    // Toggle menu
    hamburger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = container.classList.toggle("header--menu-open");
        hamburger.setAttribute("aria-expanded", isOpen);

        // Prevent body scroll when menu is open
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
        if (container.classList.contains("header--menu-open") && !container.contains(e.target)) {
            container.classList.remove("header--menu-open");
            document.body.style.overflow = "";
        }
    });

    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            container.classList.remove("header--menu-open");
            document.body.style.overflow = "";
        });
    });

    // Handle "Mis Boletas" button click
    const myTicketsBtn = container.querySelector('#my-boletas-btn') || container.querySelector('#my-tickets-btn');
    if (myTicketsBtn) {
        myTicketsBtn.addEventListener("click", () => {
            // Show my boletas modal
            showMyTicketsModal();
        });
    }
}

// Show My Boletas Modal
async function showMyTicketsModal() {
    const userSecret = getUserSecret();
    
    // Create modal with loading state
    const modal = document.createElement('div');
    modal.className = 'my-tickets-modal';
    modal.innerHTML = `
        <div class="my-tickets-modal__overlay"></div>
        <div class="my-tickets-modal__content">
            <div class="my-tickets-modal__header">
                <h2 class="my-tickets-modal__title">Mis Boletas</h2>
                <button class="my-tickets-modal__close" aria-label="Cerrar">×</button>
            </div>
            <div class="my-tickets-modal__body">
                <div class="my-tickets-modal__loading">
                    <p>Cargando tus boletas...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    const closeBtn = modal.querySelector('.my-tickets-modal__close');
    const overlay = modal.querySelector('.my-tickets-modal__overlay');
    const modalBody = modal.querySelector('.my-tickets-modal__body');
    
    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = '';
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // Load boletas from MongoDB
    try {
        const response = await getMyTicketsFromDB(userSecret);
        const savedTickets = response.tickets || [];
        
        modalBody.innerHTML = savedTickets.length === 0 
            ? `<div class="my-tickets-modal__empty">
                <p>No tienes boletas guardadas aun.</p>
                <p style="margin-top: 0.5rem; font-size: 0.9rem; color: rgba(255,255,255,0.6);">
                    Cuando busques una boleta con tu codigo, se guardara automaticamente aqui.
                </p>
            </div>`
            : `<div class="my-tickets-modal__list">
                ${savedTickets.map(ticket => `
                    <div class="my-tickets-modal__ticket" data-code="${ticket.code}">
                        <div class="my-tickets-modal__ticket-header">
                            <span class="my-tickets-modal__ticket-code">${escapeHtml(ticket.code)}</span>
                            <button class="my-tickets-modal__ticket-remove" data-code="${ticket.code}" aria-label="Eliminar">×</button>
                        </div>
                        <div class="my-tickets-modal__ticket-info">
                            <p class="my-tickets-modal__ticket-raffle">${escapeHtml(ticket.raffleTitle || 'Rifa')}</p>
                            <p class="my-tickets-modal__ticket-number">Boleta #${formatTicketNumber(ticket.ticketNumber)}</p>
                        </div>
                        <button class="my-tickets-modal__ticket-track" data-code="${ticket.code}">Ver Detalles</button>
                    </div>
                `).join('')}
            </div>`;
        
        // Track boleta buttons
        modal.querySelectorAll('.my-tickets-modal__ticket-track').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.code;
                closeModal();
                // Scroll to tracking form and fill it
                setTimeout(() => {
                    const trackingForm = document.querySelector('#tracking-form');
                    const trackingInput = document.querySelector('#boleta-code');
                    if (trackingForm && trackingInput) {
                        trackingInput.value = code;
                        trackingForm.dispatchEvent(new Event('submit'));
                        trackingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            });
        });
        
        // Remove boleta buttons
        modal.querySelectorAll('.my-tickets-modal__ticket-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const code = btn.dataset.code;
                try {
                    await removeSavedTicketFromDB(code, userSecret);
                    // Refresh modal
                    closeModal();
                    showMyTicketsModal();
                } catch (error) {
                    try { (await import('../utils/logger.js')).devError('Error removing boleta:', error); } catch (_) {}
                    alert('Error al eliminar la boleta. Por favor, intenta nuevamente.');
                }
            });
        });
        
    } catch (error) {
        try { (await import('../utils/logger.js')).devError('Error loading boletas:', error); } catch (_) {}
        modalBody.innerHTML = `
            <div class="my-tickets-modal__empty">
                <p style="color: #fca5a5;">Error al cargar las boletas.</p>
                <p style="margin-top: 0.5rem; font-size: 0.9rem; color: rgba(255,255,255,0.6);">
                    Por favor, intenta nuevamente más tarde.
                </p>
            </div>
        `;
    }
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Escape key to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Save boleta to MongoDB (exported for use in main.js)
export async function saveTicket(ticketData) {
    const userSecret = getUserSecret();
    const { saveTicketToDB } = await import('../api.js');

    try {
        await saveTicketToDB(
            ticketData.code,
            userSecret,
            ticketData.email || null,
            ticketData.phone || null
        );
    } catch (error) {
        try { (await import('../utils/logger.js')).devError('Error saving boleta to database:', error); } catch (_) {}
        // Silently fail - don't interrupt user experience
    }
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => {
        return '&#' + c.charCodeAt(0) + ';';
    });
}

function formatTicketNumber(ticketNumber) {
    return String(ticketNumber).padStart(4, '0');
}
