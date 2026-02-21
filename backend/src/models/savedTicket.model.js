const mongoose = require('mongoose');

const SavedTicketSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  ticketNumber: { type: Number, required: true },
  raffleTitle: { type: String, required: true },
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  boughtAt: { type: Date, required: true },
  savedAt: { type: Date, default: Date.now },
  // Identificador del usuario (puede ser email o phone)
  userId: { type: String, required: true, index: true }
});

// Índice compuesto para búsquedas rápidas por usuario
SavedTicketSchema.index({ userId: 1, code: 1 });

module.exports = mongoose.model('SavedTicket', SavedTicketSchema);
