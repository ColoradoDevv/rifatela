const { supabase, isNoRowsError } = require('../config/supabase');
const raffleService = require('../services/raffle.service');

const { TICKET_PRICE_COP, MAX_TICKETS } = raffleService;

function mapRaffleRow(row) {
  return {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    prize: row.prize,
    pricePerTicket: row.price_per_ticket,
    totalTickets: row.total_tickets ?? MAX_TICKETS,
    ticketsSold: row.tickets_sold ?? 0,
    status: row.status,
    winner: row.winner || null,
    drawDate: row.draw_date || null,
    createdAt: row.created_at
  };
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

function mapSavedTicketRow(row) {
  return {
    _id: row.id,
    id: row.id,
    code: row.code,
    ticketNumber: row.ticket_number,
    raffleTitle: row.raffle_title,
    raffleId: row.raffle_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    boughtAt: row.bought_at,
    savedAt: row.saved_at,
    userSecret: row.user_secret
  };
}

async function fetchRaffleById(id) {
  const { data, error } = await supabase
    .from('raffles')
    .select('id,title,description,prize,price_per_ticket,total_tickets,tickets_sold,status,winner,draw_date,created_at')
    .eq('id', id)
    .maybeSingle();

  if (error && !isNoRowsError(error)) {
    throw error;
  }

  return data || null;
}

async function countParticipantsByRaffleId(raffleId) {
  const { count, error } = await supabase
    .from('raffle_participants')
    .select('id', { head: true, count: 'exact' })
    .eq('raffle_id', raffleId);

  if (error) throw error;
  return count || 0;
}

// GET /api/raffles - paginado
exports.list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('raffles')
      .select('id,title,description,prize,price_per_ticket,total_tickets,tickets_sold,status,winner,draw_date,created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(skip, skip + limit - 1);

    if (error) throw error;

    const items = (data || []).map((row) => ({
      ...mapRaffleRow(row),
      totalTickets: MAX_TICKETS,
      ticketsSold: row.tickets_sold ?? 0
    }));

    const total = count || 0;
    res.json({
      items,
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
    const raffle = await fetchRaffleById(req.params.id);
    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' });

    const { data: participantsRows, error: participantsError } = await supabase
      .from('raffle_participants')
      .select('name,email,phone,ticket_number,code,bought_at,payment_method,registered_by')
      .eq('raffle_id', req.params.id)
      .order('ticket_number', { ascending: true });

    if (participantsError) throw participantsError;

    const participants = (participantsRows || []).map(mapParticipantRow);
    const ticketsSold = participants.length || raffle.tickets_sold || 0;

    res.json({
      ...mapRaffleRow(raffle),
      participants,
      ticketsSold,
      totalTickets: MAX_TICKETS
    });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ message: 'Rifa no encontrada' });
    }
    res.status(500).json({ message: 'Error al obtener la rifa', error: err.message });
  }
};

// POST /api/raffles
exports.create = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ message: 'El titulo es obligatorio' });

    const { data, error } = await supabase
      .from('raffles')
      .insert({
        title,
        description: description || null,
        price_per_ticket: TICKET_PRICE_COP,
        total_tickets: MAX_TICKETS,
        tickets_sold: 0,
        status: 'active'
      })
      .select('id,title,description,prize,price_per_ticket,total_tickets,tickets_sold,status,winner,draw_date,created_at')
      .single();

    if (error) throw error;

    res.status(201).json(mapRaffleRow(data));
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

// GET /api/raffles/admin/stats
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

    const [rafflesResult, participantsResult] = await Promise.all([
      supabase.from('raffles').select('id,title,status'),
      supabase.from('raffle_participants').select('raffle_id,ticket_number,code,name,payment_method,registered_by,bought_at')
    ]);

    if (rafflesResult.error) throw rafflesResult.error;
    if (participantsResult.error) throw participantsResult.error;

    const raffles = rafflesResult.data || [];
    const participants = participantsResult.data || [];

    const totalRaffles = raffles.length;
    const activeRaffles = raffles.filter((r) => r.status === 'active').length;
    const completedRaffles = raffles.filter((r) => r.status === 'completed').length;
    const totalTicketsSold = participants.length;
    const grossRevenue = totalTicketsSold * TICKET_PRICE_COP;

    const raffleById = new Map(raffles.map((r) => [r.id, r]));
    const salesByRaffle = new Map();
    const salesBySeller = new Map();

    for (const participant of participants) {
      const raffleId = participant.raffle_id;
      salesByRaffle.set(raffleId, (salesByRaffle.get(raffleId) || 0) + 1);

      const seller = participant.registered_by || 'public';
      salesBySeller.set(seller, (salesBySeller.get(seller) || 0) + 1);

      const date = participant.bought_at ? new Date(participant.bought_at) : now;
      if (!Number.isNaN(date.getTime())) {
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        const bucket = monthlyMap.get(monthKey);
        if (bucket) {
          bucket.sales += 1;
          bucket.revenue += TICKET_PRICE_COP;
        }
      }
    }

    const topRaffles = raffles
      .map((raffle) => {
        const ticketsSold = salesByRaffle.get(raffle.id) || 0;
        return {
          id: raffle.id,
          title: raffle.title,
          status: raffle.status,
          ticketsSold,
          totalTickets: MAX_TICKETS,
          revenue: ticketsSold * TICKET_PRICE_COP
        };
      })
      .sort((a, b) => b.ticketsSold - a.ticketsSold)
      .slice(0, 5);

    const sellerRanking = Array.from(salesBySeller.entries())
      .map(([seller, sales]) => ({ seller, sales }))
      .sort((a, b) => b.sales - a.sales);

    const recentSales = [...participants]
      .sort((a, b) => {
        const aTime = a.bought_at ? new Date(a.bought_at).getTime() : 0;
        const bTime = b.bought_at ? new Date(b.bought_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 15)
      .map((participant) => ({
        raffleTitle: raffleById.get(participant.raffle_id)?.title || 'Rifa',
        ticketNumber: participant.ticket_number,
        code: participant.code,
        buyerName: participant.name,
        paymentMethod: participant.payment_method || 'WhatsApp',
        registeredBy: participant.registered_by || 'public',
        boughtAt: participant.bought_at
      }));

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
      recentSales
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener estadisticas', error: err.message });
  }
};

// GET /api/raffles/ticket/:code
exports.trackTicket = async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = String(code || '').toUpperCase();

    const { data: participant, error: participantError } = await supabase
      .from('raffle_participants')
      .select('raffle_id,name,email,phone,ticket_number,code,bought_at')
      .eq('code', upperCode)
      .maybeSingle();

    if (participantError && !isNoRowsError(participantError)) throw participantError;
    if (!participant) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    const raffle = await fetchRaffleById(participant.raffle_id);
    if (!raffle) {
      return res.status(404).json({ message: 'Rifa no encontrada' });
    }

    const ticketsSold = await countParticipantsByRaffleId(raffle.id);

    res.json({
      ...mapRaffleRow(raffle),
      ticketsSold,
      totalTickets: MAX_TICKETS,
      participant: {
        name: participant.name,
        email: participant.email,
        phone: participant.phone,
        ticketNumber: participant.ticket_number,
        code: participant.code,
        boughtAt: participant.bought_at
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
    const raffle = await fetchRaffleById(id);

    if (!raffle) return res.status(404).json({ message: 'Rifa no encontrada' });

    if (raffle.status === 'completed') {
      return res.status(400).json({ message: 'Esta rifa ya fue sorteada', winner: raffle.winner || null });
    }

    const { data: participantsRows, error: participantsError } = await supabase
      .from('raffle_participants')
      .select('name,email,code,ticket_number')
      .eq('raffle_id', id);

    if (participantsError) throw participantsError;

    const participants = (participantsRows || []).map((row) => ({
      name: row.name,
      email: row.email,
      code: row.code,
      ticketNumber: row.ticket_number
    }));

    const winnerData = raffleService.drawWinnerInternal({
      status: raffle.status,
      participants
    });

    const { error: updateError } = await supabase
      .from('raffles')
      .update({
        winner: winnerData,
        status: 'completed',
        draw_date: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    res.json({ winner: winnerData, message: `Felicidades a ${winnerData.name}` });
  } catch (err) {
    if (err.message === 'No hay participantes') {
      return res.status(400).json({ message: err.message });
    }
    if (err.message === 'Esta rifa ya fue sorteada') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === '22P02') {
      return res.status(404).json({ message: 'Rifa no encontrada' });
    }
    res.status(500).json({ message: 'Error en el sorteo', error: err.message });
  }
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getUserSecretFromRequest(req) {
  return req.headers['x-user-secret'] || req.body?.userSecret || null;
}

// POST /api/raffles/tickets/save
exports.saveTicket = async (req, res) => {
  try {
    const { code, userSecret, email, phone } = req.body;
    const secret = userSecret || getUserSecretFromRequest(req);
    const upperCode = String(code || '').toUpperCase();

    if (!upperCode || !secret) {
      return res.status(400).json({ message: 'Codigo y userSecret son obligatorios' });
    }
    if (!UUID_REGEX.test(secret)) {
      return res.status(400).json({ message: 'userSecret debe ser un UUID valido' });
    }

    const { data: participant, error: participantError } = await supabase
      .from('raffle_participants')
      .select('raffle_id,name,email,phone,ticket_number,code,bought_at')
      .eq('code', upperCode)
      .maybeSingle();

    if (participantError && !isNoRowsError(participantError)) throw participantError;
    if (!participant) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    const raffle = await fetchRaffleById(participant.raffle_id);
    if (!raffle) {
      return res.status(404).json({ message: 'Rifa no encontrada' });
    }

    const { data: existing, error: existingError } = await supabase
      .from('saved_tickets')
      .select('*')
      .eq('code', upperCode)
      .eq('user_secret', secret)
      .maybeSingle();

    if (existingError && !isNoRowsError(existingError)) throw existingError;
    if (existing) {
      return res.json({
        success: true,
        message: 'Boleta ya guardada',
        ticket: mapSavedTicketRow(existing)
      });
    }

    const { data: savedTicket, error: insertError } = await supabase
      .from('saved_tickets')
      .insert({
        code: upperCode,
        ticket_number: participant.ticket_number,
        raffle_title: raffle.title,
        raffle_id: raffle.id,
        name: participant.name,
        email: email || participant.email,
        phone: phone || participant.phone,
        bought_at: participant.bought_at,
        user_secret: secret
      })
      .select('*')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ message: 'Esta boleta ya esta guardada' });
      }
      throw insertError;
    }

    res.json({
      success: true,
      message: 'Boleta guardada exitosamente',
      ticket: mapSavedTicketRow(savedTicket)
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al guardar la boleta', error: err.message });
  }
};

// GET /api/raffles/tickets/my - header X-User-Secret obligatorio
exports.getMyTickets = async (req, res) => {
  try {
    const userSecret = getUserSecretFromRequest(req);

    if (!userSecret) {
      return res.status(400).json({ message: 'Header X-User-Secret o body.userSecret es obligatorio' });
    }
    if (!UUID_REGEX.test(userSecret)) {
      return res.status(400).json({ message: 'userSecret debe ser un UUID valido' });
    }

    const { data, error } = await supabase
      .from('saved_tickets')
      .select('*')
      .eq('user_secret', userSecret)
      .order('saved_at', { ascending: false });

    if (error) throw error;

    const savedTickets = (data || []).map(mapSavedTicketRow);
    res.json({ success: true, tickets: savedTickets, count: savedTickets.length });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener las boletas', error: err.message });
  }
};

// DELETE /api/raffles/tickets/:code - header X-User-Secret obligatorio
exports.removeSavedTicket = async (req, res) => {
  try {
    const { code } = req.params;
    const userSecret = getUserSecretFromRequest(req);
    const upperCode = String(code || '').toUpperCase();

    if (!upperCode) {
      return res.status(400).json({ message: 'Codigo es obligatorio' });
    }
    if (!userSecret) {
      return res.status(400).json({ message: 'Header X-User-Secret o body.userSecret es obligatorio' });
    }
    if (!UUID_REGEX.test(userSecret)) {
      return res.status(400).json({ message: 'userSecret debe ser un UUID valido' });
    }

    const { data, error } = await supabase
      .from('saved_tickets')
      .delete()
      .eq('code', upperCode)
      .eq('user_secret', userSecret)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'Boleta no encontrada' });
    }

    res.json({ success: true, message: 'Boleta eliminada exitosamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error al eliminar la boleta', error: err.message });
  }
};
