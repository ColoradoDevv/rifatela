const crypto = require('crypto');
const { supabase, isNoRowsError } = require('../config/supabase');

const TICKET_PRICE_COP = 40000;
const MAX_TICKETS = 10000;
const MIN_TICKET_NUMBER = 0;
const MAX_TICKET_NUMBER = 9999;
const TICKET_DIGITS = 4;

async function generateOneTimeCode(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = String(crypto.randomInt(100000, 1000000));
    const { data, error } = await supabase
      .from('raffle_participants')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (error && !isNoRowsError(error)) {
      throw new Error(error.message || 'Error consultando codigo unico');
    }

    if (!data) return code;
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

function mapParticipantRow(row) {
  return {
    name: row.name,
    email: row.email,
    phone: row.phone,
    ticketNumber: row.ticket_number,
    code: row.code,
    boughtAt: row.bought_at,
    paymentMethod: row.payment_method,
    registeredBy: row.registered_by
  };
}

async function fetchRaffleById(raffleId) {
  const { data, error } = await supabase
    .from('raffles')
    .select('id,title,status')
    .eq('id', raffleId)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw new Error(error.message || 'Error consultando rifa');
  }

  return data || null;
}

async function fetchRaffleParticipants(raffleId) {
  const { data, error } = await supabase
    .from('raffle_participants')
    .select('ticket_number')
    .eq('raffle_id', raffleId);

  if (error) {
    throw new Error(error.message || 'Error consultando participantes');
  }

  return (data || []).map((row) => ({ ticketNumber: row.ticket_number }));
}

function classifyUniqueViolation(error) {
  const joined = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  if (joined.includes('code')) return 'code';
  if (joined.includes('ticket_number') || joined.includes('raffle_id_ticket_number')) return 'ticket';
  return 'unknown';
}

async function insertParticipantWithUniqueCode(payload, maxCodeAttempts = 50) {
  for (let i = 0; i < maxCodeAttempts; i++) {
    const code = String(crypto.randomInt(100000, 1000000));

    const { error } = await supabase
      .from('raffle_participants')
      .insert({
        raffle_id: payload.raffleId,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        ticket_number: payload.ticketNumber,
        code,
        payment_method: payload.paymentMethod,
        registered_by: payload.registeredBy,
        bought_at: new Date().toISOString()
      });

    if (!error) {
      return { ok: true, code };
    }

    if (error.code === '23505') {
      const conflict = classifyUniqueViolation(error);
      if (conflict === 'code') continue;
      if (conflict === 'ticket') return { ok: false, conflict: 'ticket' };
    } else {
      throw new Error(error.message || 'Error insertando participante');
    }
  }

  return { ok: false, conflict: 'code' };
}

async function syncTicketsSold(raffleId) {
  const { count, error: countError } = await supabase
    .from('raffle_participants')
    .select('id', { head: true, count: 'exact' })
    .eq('raffle_id', raffleId);

  if (countError) {
    throw new Error(countError.message || 'Error contando boletas vendidas');
  }

  const ticketsSold = count || 0;
  const { error: updateError } = await supabase
    .from('raffles')
    .update({ tickets_sold: ticketsSold })
    .eq('id', raffleId);

  if (updateError) {
    throw new Error(updateError.message || 'Error actualizando boletas vendidas');
  }

  return ticketsSold;
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

  const raffle = await fetchRaffleById(raffleId);
  if (!raffle) {
    return { status: 404, body: { message: 'Rifa no encontrada' } };
  }
  if (raffle.status !== 'active') {
    return { status: 400, body: { message: 'Esta rifa ya no esta activa' } };
  }

  try {
    let insertedCode = null;
    let resolvedTicketNumber = null;

    // Reintenta en caso de colision por asignacion automatica de boleta.
    for (let i = 0; i < 5; i++) {
      const participants = await fetchRaffleParticipants(raffleId);
      resolvedTicketNumber = resolveTicketNumber({ participants }, requestedTicketNumber);

      const insertResult = await insertParticipantWithUniqueCode({
        raffleId,
        name,
        email,
        phone: phone || null,
        ticketNumber: resolvedTicketNumber,
        paymentMethod,
        registeredBy: registeredBy || 'public'
      });

      if (insertResult.ok) {
        insertedCode = insertResult.code;
        break;
      }

      if (insertResult.conflict === 'ticket') {
        if (requestedTicketNumber !== null) {
          return { status: 400, body: { message: `La boleta #${formatTicketNumber(resolvedTicketNumber)} ya esta ocupada` } };
        }
        continue;
      }

      if (insertResult.conflict === 'code') {
        return { status: 400, body: { message: 'No se pudo generar un codigo unico de 6 cifras' } };
      }
    }

    if (!insertedCode || resolvedTicketNumber === null) {
      return { status: 400, body: { message: 'No se pudo registrar la venta. Intenta nuevamente.' } };
    }

    await syncTicketsSold(raffleId);

    return {
      status: 200,
      body: {
        ticketNumber: resolvedTicketNumber,
        ticketNumberFormatted: formatTicketNumber(resolvedTicketNumber),
        code: insertedCode,
        raffleName: raffle.title,
        message: `Compra exitosa. Tu codigo unico de seguimiento es: ${insertedCode}`
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
  mapParticipantRow,
  registerSaleInternal,
  drawWinnerInternal
};
