const mongoose = require('mongoose');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ParticipantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => emailRegex.test(v),
      message: 'El correo electrónico no es válido'
    }
  },
  phone: { type: String },
  ticketNumber: { type: Number, required: true, min: 0, max: 9999 },
  code: { type: String, unique: true },
  boughtAt: { type: Date, default: Date.now },
  paymentMethod: { type: String, default: 'WhatsApp' },
  registeredBy: { type: String, default: 'admin' }
});

const RaffleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  prize: String,
  pricePerTicket: { type: Number, default: 40000 },
  totalTickets: { type: Number, default: 10000 },
  ticketsSold: { type: Number, default: 0 },
  participants: [ParticipantSchema],
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  winner: { type: mongoose.Schema.Types.Mixed, default: null },
  drawDate: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Raffle', RaffleSchema);
