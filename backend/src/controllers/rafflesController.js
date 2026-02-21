const Raffle = require('../models/raffle.model');
const SavedTicket = require('../models/savedTicket.model');
const TICKET_PRICE_COP = 40000;
const MAX_TICKETS = 10000;
const MIN_TICKET_NUMBER = 0;
const MAX_TICKET_NUMBER = 9999;
const TICKET_DIGITS = 4;

async function generateOneTimeCode(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
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
    if (ticketNumber === num) {
      ticketNumber++;
    } else {
      break;
    }
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

// GET /api/raffles
exports.list = async (req, res) => {
  try {
    const items = await Raffle.find().select('-participants').sort({ createdAt: -1 }).lean();
    const normalized = items.map((item) => ({ ...item, totalTickets: MAX_TICKETS }));
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener las rifas', error: err.message });
  }
};

// GET /api/raffles/:id
exports.getById = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id).lean();
    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' });
    res.json({ ...raffle, totalTickets: MAX_TICKETS });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener la rifa', error: err.message });
  }
};

// POST /api/raffles
exports.create = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ message: 'El titulo es obligatorio' });

    const raffle = new Raffle({
      title,
      description,
      pricePerTicket: TICKET_PRICE_COP,
      totalTickets: MAX_TICKETS
    });
    await raffle.save();
    res.status(201).json(raffle);
  } catch (err) {
    res.status(500).json({ message: 'Error al crear la rifa', error: err.message });
  }
};

// POST /api/raffles/:id/buy (public)
exports.buyTicket = async (req, res) => {
  try {
    const result = await registerSaleInternal({
      raffleId: req.params.id,
      payload: req.body,
      registeredBy: 'public'
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ message: 'Error al comprar la boleta', error: err.message });
  }
};

// POST /api/raffles/:id/register-sale (seller/admin only)
exports.registerSale = async (req, res) => {
  try {
    const result = await registerSaleInternal({
      raffleId: req.params.id,
      payload: req.body,
      registeredBy: req.user?.username || req.user?.role || 'seller'
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ message: 'Error al registrar la venta', error: err.message });
  }
};

// GET /api/raffles/admin/stats
exports.adminStats = async (_req, res) => {
  try {
    const raffles = await Raffle.find().lean();

    const totalRaffles = raffles.length;
    const activeRaffles = raffles.filter((r) => r.status === 'active').length;
    const completedRaffles = raffles.filter((r) => r.status === 'completed').length;

    const totalTicketsSold = raffles.reduce((acc, raffle) => acc + (raffle.participants?.length || 0), 0);
    const grossRevenue = raffles.reduce((acc, raffle) => {
      const sold = raffle.participants?.length || 0;
      return acc + sold * TICKET_PRICE_COP;
    }, 0);

    const salesBySeller = {};
    const recentSales = [];
    const monthlyMap = new Map();

    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, {
        key,
        label: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        sales: 0,
        revenue: 0
      });
    }

    for (const raffle of raffles) {
      for (const participant of raffle.participants || []) {
        const sellerKey = participant.registeredBy || 'public';
        salesBySeller[sellerKey] = (salesBySeller[sellerKey] || 0) + 1;

        const boughtAt = new Date(participant.boughtAt);
        if (!Number.isNaN(boughtAt.getTime())) {
          const monthKey = `${boughtAt.getUTCFullYear()}-${String(boughtAt.getUTCMonth() + 1).padStart(2, '0')}`;
          const bucket = monthlyMap.get(monthKey);
          if (bucket) {
            bucket.sales += 1;
            bucket.revenue += TICKET_PRICE_COP;
          }
        }

        recentSales.push({
          raffleTitle: raffle.title,
          ticketNumber: participant.ticketNumber,
          code: participant.code,
          buyerName: participant.name,
          paymentMethod: participant.paymentMethod || 'WhatsApp',
          registeredBy: sellerKey,
          boughtAt: participant.boughtAt
        });
      }
    }

    const topRaffles = raffles
      .map((raffle) => ({
        id: raffle._id,
        title: raffle.title,
        status: raffle.status,
        ticketsSold: raffle.participants?.length || 0,
        totalTickets: MAX_TICKETS,
        revenue: (raffle.participants?.length || 0) * TICKET_PRICE_COP
      }))
      .sort((a, b) => b.ticketsSold - a.ticketsSold)
      .slice(0, 5);

    const sellerRanking = Object.entries(salesBySeller)
      .map(([seller, sales]) => ({ seller, sales }))
      .sort((a, b) => b.sales - a.sales);

    recentSales.sort((a, b) => new Date(b.boughtAt) - new Date(a.boughtAt));

    res.json({
      success: true,
      stats: {
        totalRaffles,
        activeRaffles,
        completedRaffles,
        totalTicketsSold,
        grossRevenue
      },
      topRaffles,
      sellerRanking,
      monthlyRevenueSeries: Array.from(monthlyMap.values()),
      recentSales: recentSales.slice(0, 15)
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener estadisticas', error: err.message });
  }
};

// GET /api/raffles/ticket/:code
exports.trackTicket = async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();

    const raffle = await Raffle.findOne(
      { 'participants.code': upperCode },
      {
        title: 1,
        description: 1,
        prize: 1,
        status: 1,
        winner: 1,
        pricePerTicket: 1,
        totalTickets: 1,
        ticketsSold: 1,
        drawDate: 1,
        createdAt: 1,
        'participants.$': 1
      }
    ).lean();

    if (!raffle) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    const participant = raffle.participants[0];
    const isWinner = raffle.winner && raffle.winner.code === upperCode;

    const boughtDate = new Date(participant.boughtAt);
    const formattedDate = boughtDate.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    res.json({
      found: true,
      ticket: {
        code: participant.code,
        name: participant.name,
        email: participant.email || null,
        ticketNumber: participant.ticketNumber,
        ticketNumberFormatted: formatTicketNumber(participant.ticketNumber),
        boughtAt: participant.boughtAt,
        formattedDate,
        phone: participant.phone || null
      },
      raffle: {
        title: raffle.title,
        description: raffle.description || '',
        prize: raffle.prize || '',
        status: raffle.status,
        isWinner,
        pricePerTicket: TICKET_PRICE_COP,
        totalTickets: MAX_TICKETS,
        ticketsSold: raffle.ticketsSold || 0,
        ticketsRemaining: Math.max(0, MAX_TICKETS - (raffle.ticketsSold || 0)),
        soldPercentage: Math.round(((raffle.ticketsSold || 0) / MAX_TICKETS) * 100),
        drawDate: raffle.drawDate || null,
        createdAt: raffle.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al buscar la boleta', error: err.message });
  }
};

// POST /api/raffles/:id/draw
exports.drawWinner = async (req, res) => {
  try {
    const { id } = req.params;
    const raffle = await Raffle.findById(id);

    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' });
    if (raffle.participants.length === 0) {
      return res.status(400).json({ message: 'No hay participantes' });
    }
    if (raffle.status === 'completed') {
      return res.status(400).json({ message: 'Esta rifa ya fue sorteada', winner: raffle.winner });
    }

    const winner = raffle.participants[Math.floor(Math.random() * raffle.participants.length)];
    raffle.winner = { name: winner.name, email: winner.email, code: winner.code, ticketNumber: winner.ticketNumber };
    raffle.status = 'completed';
    await raffle.save();

    res.json({ winner: raffle.winner, message: `Felicidades a ${winner.name}` });
  } catch (err) {
    res.status(500).json({ message: 'Error en el sorteo', error: err.message });
  }
};

// POST /api/raffles/tickets/save
exports.saveTicket = async (req, res) => {
  try {
    const { code, userId, email, phone } = req.body;

    if (!code || !userId) {
      return res.status(400).json({ message: 'Codigo y userId son obligatorios' });
    }

    const raffle = await Raffle.findOne(
      { 'participants.code': code.toUpperCase() },
      { title: 1, _id: 1, 'participants.$': 1 }
    ).lean();

    if (!raffle || !raffle.participants || raffle.participants.length === 0) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    const participant = raffle.participants[0];

    const existing = await SavedTicket.findOne({ code: code.toUpperCase(), userId });
    if (existing) {
      return res.json({
        success: true,
        message: 'Boleta ya guardada',
        ticket: existing
      });
    }

    const savedTicket = new SavedTicket({
      code: code.toUpperCase(),
      ticketNumber: participant.ticketNumber,
      raffleTitle: raffle.title,
      raffleId: raffle._id,
      name: participant.name,
      email: email || participant.email,
      phone: phone || participant.phone,
      boughtAt: participant.boughtAt,
      userId
    });

    await savedTicket.save();

    res.json({
      success: true,
      message: 'Boleta guardada exitosamente',
      ticket: savedTicket
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Esta boleta ya esta guardada' });
    }
    res.status(500).json({ message: 'Error al guardar la boleta', error: err.message });
  }
};

// GET /api/raffles/tickets/my/:userId
exports.getMyTickets = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'userId es obligatorio' });
    }

    const savedTickets = await SavedTicket.find({ userId }).sort({ savedAt: -1 }).lean();

    res.json({ success: true, tickets: savedTickets, count: savedTickets.length });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener las boletas', error: err.message });
  }
};

// DELETE /api/raffles/tickets/:code/:userId
exports.removeSavedTicket = async (req, res) => {
  try {
    const { code, userId } = req.params;

    if (!code || !userId) {
      return res.status(400).json({ message: 'Codigo y userId son obligatorios' });
    }

    const deleted = await SavedTicket.findOneAndDelete({ code: code.toUpperCase(), userId });

    if (!deleted) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    res.json({ success: true, message: 'Boleta eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la boleta', error: err.message });
  }
};
