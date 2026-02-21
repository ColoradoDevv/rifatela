const crypto = require('crypto');
const Raffle = require('../models/raffle.model');

const TICKET_PRICE_COP = 40000;
const MAX_TICKETS = 10000;
const MIN_TICKET_NUMBER = 0;
const MAX_TICKET_NUMBER = 9999;
const TICKET_DIGITS = 4;

async function generateOneTimeCode(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = String(crypto.randomInt(100000, 1000000));
    const exists = await Raffle.exists({ 'participants.code': code });
    if (!exists) return code;
  }
  throw new Error('No se pudo generar un codigo unico de 6 cifras');
}

function formatTicketNumber(ticketNumber) {
  return String(ticketNumber).padStart(TICKET_DIGITS, '0');
}

function normalizeRequestedTicketNumber(requestedTicketNumber) {
  if (requestedTicketNumber === undefined || requestedTicketNumber === null || requestedTicketNumber === '') {
    return null;
  }
  const raw = String(requestedTicketNumber).trim();
  if (!/^\d{4}$/.test(raw)) {
    throw new Error('La boleta debe tener exactamente 4 digitos');
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNextAvailableTicketNumber(raffle) {
  const usedNumbers = raffle.participants.map((p) => p.ticketNumber).sort((a, b) => a - b);
  let ticketNumber = MIN_TICKET_NUMBER;
  for (const num of usedNumbers) {
    if (ticketNumber === num) ticketNumber++;
    else break;
  }
  return ticketNumber;
}

function resolveTicketNumber(raffle, requestedTicketNumber) {
  const maxAllowed = MAX_TICKET_NUMBER;
  if (requestedTicketNumber !== null) {
    if (!Number.isInteger(requestedTicketNumber)) {
      throw new Error('El numero de boleta debe ser un entero');
    }
    if (requestedTicketNumber < MIN_TICKET_NUMBER || requestedTicketNumber > maxAllowed) {
      throw new Error(`La boleta debe estar entre ${formatTicketNumber(MIN_TICKET_NUMBER)} y ${formatTicketNumber(maxAllowed)}`);
    }
    const existingTicket = raffle.participants.find((p) => p.ticketNumber === requestedTicketNumber);
    if (existingTicket) {
      throw new Error(`La boleta #${formatTicketNumber(requestedTicketNumber)} ya esta ocupada`);
    }
    return requestedTicketNumber;
  }
  const nextNumber = getNextAvailableTicketNumber(raffle);
  if (nextNumber < MIN_TICKET_NUMBER || nextNumber > maxAllowed) {
    throw new Error('Boletas agotadas');
  }
  return nextNumber;
}

async function registerSaleInternal({ raffleId, payload, registeredBy }) {
  const { name, email, phone, ticketNumber: incomingTicketNumber, paymentMethod = 'WhatsApp' } = payload;
  let requestedTicketNumber;
  try {
    requestedTicketNumber = normalizeRequestedTicketNumber(incomingTicketNumber);
  } catch (err) {
    return { status: 400, body: { message: err.message } };
  }

  if (!name || !email) {
    return { status: 400, body: { message: 'Nombre y email son obligatorios' } };
  }

  const raffle = await Raffle.findById(raffleId);
  if (!raffle) {
    return { status: 404, body: { message: 'Rifa no encontrada' } };
  }
  if (raffle.status !== 'active') {
    return { status: 400, body: { message: 'Esta rifa ya no esta activa' } };
  }

  try {
    const ticketNumber = resolveTicketNumber(raffle, requestedTicketNumber);
    const code = await generateOneTimeCode();

    raffle.participants.push({
      name,
      email,
      phone,
      ticketNumber,
      code,
      paymentMethod,
      registeredBy: registeredBy || 'public'
    });

    raffle.ticketsSold = raffle.participants.length;
    await raffle.save();

    return {
      status: 200,
      body: {
        ticketNumber,
        ticketNumberFormatted: formatTicketNumber(ticketNumber),
        code,
        raffleName: raffle.title,
        message: `Compra exitosa. Tu codigo unico de seguimiento es: ${code}`
      }
    };
  } catch (err) {
    return { status: 400, body: { message: err.message } };
  }
}

function drawWinnerInternal(raffle) {
  if (!raffle.participants.length) throw new Error('No hay participantes');
  if (raffle.status === 'completed') throw new Error('Esta rifa ya fue sorteada');
  const index = crypto.randomInt(0, raffle.participants.length);
  const winner = raffle.participants[index];
  return { name: winner.name, email: winner.email, code: winner.code, ticketNumber: winner.ticketNumber };
}

module.exports = {
  TICKET_PRICE_COP,
  MAX_TICKETS,
  MIN_TICKET_NUMBER,
  MAX_TICKET_NUMBER,
  TICKET_DIGITS,
  formatTicketNumber,
  generateOneTimeCode,
  normalizeRequestedTicketNumber,
  getNextAvailableTicketNumber,
  resolveTicketNumber,
  registerSaleInternal,
  drawWinnerInternal
};
