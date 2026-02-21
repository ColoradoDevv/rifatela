const Raffle = require('../models/raffle.model');
const SavedTicket = require('../models/savedTicket.model');
const raffleService = require('../services/raffle.service');

const { TICKET_PRICE_COP, MAX_TICKETS } = raffleService;

// GET /api/raffles — paginado
exports.list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Raffle.find()
        .select('-participants')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Raffle.countDocuments()
    ]);

    const normalized = items.map((item) => ({
      ...item,
      totalTickets: MAX_TICKETS,
      ticketsSold: item.ticketsSold ?? 0
    }));

    res.json({
      items: normalized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener las rifas', error: err.message });
  }
};

// GET /api/raffles/:id
exports.getById = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id).lean();
    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' });
    const ticketsSold = raffle.participants?.length ?? raffle.ticketsSold ?? 0;
    res.json({ ...raffle, ticketsSold, totalTickets: MAX_TICKETS });
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
    const result = await raffleService.registerSaleInternal({
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
    const result = await raffleService.registerSaleInternal({
      raffleId: req.params.id,
      payload: req.body,
      registeredBy: req.user?.username || req.user?.role || 'seller'
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ message: 'Error al registrar la venta', error: err.message });
  }
};

// GET /api/raffles/admin/stats — agregaciones MongoDB
exports.adminStats = async (_req, res) => {
  try {
    const now = new Date();
    const monthlyMap = new Map();
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

    const [countsResult, totalsResult, topRafflesAgg, sellerAgg, recentSalesAgg, monthlyAgg] = await Promise.all([
      Raffle.aggregate([
        {
          $facet: {
            total: [{ $count: 'n' }],
            byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }]
          }
        }
      ]),
      Raffle.aggregate([
        { $project: { count: { $size: { $ifNull: ['$participants', []] } } } },
        {
          $group: {
            _id: null,
            totalTicketsSold: { $sum: '$count' },
            grossRevenue: { $sum: { $multiply: ['$count', TICKET_PRICE_COP] } }
          }
        }
      ]),
      Raffle.aggregate([
        {
          $project: {
            title: 1,
            status: 1,
            ticketsSold: { $size: { $ifNull: ['$participants', []] } }
          }
        },
        { $sort: { ticketsSold: -1 } },
        { $limit: 5 },
        {
          $project: {
            id: '$_id',
            title: 1,
            status: 1,
            ticketsSold: 1,
            totalTickets: { $literal: MAX_TICKETS },
            revenue: { $multiply: ['$ticketsSold', TICKET_PRICE_COP] },
            _id: 0
          }
        }
      ]),
      Raffle.aggregate([
        { $unwind: '$participants' },
        {
          $group: {
            _id: { $ifNull: ['$participants.registeredBy', 'public'] },
            sales: { $sum: 1 }
          }
        },
        { $sort: { sales: -1 } },
        { $project: { seller: '$_id', sales: 1, _id: 0 } }
      ]),
      Raffle.aggregate([
        { $unwind: '$participants' },
        { $sort: { 'participants.boughtAt': -1 } },
        { $limit: 15 },
        {
          $project: {
            raffleTitle: '$title',
            ticketNumber: '$participants.ticketNumber',
            code: '$participants.code',
            buyerName: '$participants.name',
            paymentMethod: { $ifNull: ['$participants.paymentMethod', 'WhatsApp'] },
            registeredBy: { $ifNull: ['$participants.registeredBy', 'public'] },
            boughtAt: '$participants.boughtAt',
            _id: 0
          }
        }
      ]),
      Raffle.aggregate([
        { $unwind: '$participants' },
        {
          $project: {
            monthKey: {
              $dateToString: {
                format: '%Y-%m',
                date: { $ifNull: ['$participants.boughtAt', new Date()] }
              }
            },
            revenue: { $literal: TICKET_PRICE_COP }
          }
        },
        { $group: { _id: '$monthKey', sales: { $sum: 1 }, revenue: { $sum: '$revenue' } } }
      ])
    ]);

    const facet = countsResult[0] || {};
    const totalRaffles = facet.total?.[0]?.n ?? 0;
    const byStatus = (facet.byStatus ?? []).reduce((acc, s) => {
      acc[s._id] = s.n;
      return acc;
    }, {});
    const activeRaffles = byStatus.active ?? 0;
    const completedRaffles = byStatus.completed ?? 0;

    const totals = totalsResult[0] || {};
    const totalTicketsSold = totals.totalTicketsSold ?? 0;
    const grossRevenue = totals.grossRevenue ?? 0;

    for (const row of monthlyAgg) {
      const bucket = monthlyMap.get(row._id);
      if (bucket) {
        bucket.sales = row.sales;
        bucket.revenue = row.revenue;
      }
    }

    res.json({
      success: true,
      stats: {
        totalRaffles,
        activeRaffles,
        completedRaffles,
        totalTicketsSold,
        grossRevenue
      },
      topRaffles: topRafflesAgg,
      sellerRanking: sellerAgg,
      monthlyRevenueSeries: Array.from(monthlyMap.values()),
      recentSales: recentSalesAgg
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

    if (!raffle || !raffle.participants?.length) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    const participant = raffle.participants[0];
    const ticketsSold = raffle.participants?.length ?? raffle.ticketsSold ?? 0;

    res.json({
      ...raffle,
      ticketsSold,
      totalTickets: MAX_TICKETS,
      participant: {
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        ticketNumber: participant.ticketNumber,
        code: participant.code,
        boughtAt: participant.boughtAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al consultar la boleta', error: err.message });
  }
};

// POST /api/raffles/:id/draw
exports.drawWinner = async (req, res) => {
  try {
    const { id } = req.params;
    const raffle = await Raffle.findById(id);

    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' });

    const winnerData = raffleService.drawWinnerInternal(raffle);
    raffle.winner = winnerData;
    raffle.status = 'completed';
    await raffle.save();

    res.json({ winner: raffle.winner, message: `Felicidades a ${winnerData.name}` });
  } catch (err) {
    if (err.message === 'No hay participantes') {
      return res.status(400).json({ message: err.message });
    }
    if (err.message === 'Esta rifa ya fue sorteada') {
      return res.status(400).json({ message: err.message, winner: (await Raffle.findById(req.params.id).select('winner').lean())?.winner });
    }
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
