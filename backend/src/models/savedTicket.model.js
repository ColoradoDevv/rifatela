const mongoose = require('mongoose');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SavedTicketSchema = new mongoose.Schema({
  code: { type: String, required: true },
  ticketNumber: { type: Number, required: true },
  raffleTitle: { type: String, required: true },
  raffleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Raffle', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  boughtAt: { type: Date, required: true },
  savedAt: { type: Date, default: Date.now },
  /** Secret del usuario (crypto.randomUUID()). Valida que solo el dueño acceda. */
  userSecret: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v) => UUID_REGEX.test(v),
      message: 'userSecret debe ser un UUID válido'
    }
  }
});

SavedTicketSchema.index({ userSecret: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('SavedTicket', SavedTicketSchema);
