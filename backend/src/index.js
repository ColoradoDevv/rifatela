const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { CORS_ORIGIN } = require('./config/env');
const rafflesRoutes = require('./routes/raffles');
const authRoutes = require('./routes/auth');

connectDB();

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = parseCorsOrigins(CORS_ORIGIN);

app.use(cors({
  origin(origin, callback) {
    if (allowedOrigins === true) {
      return callback(null, true);
    }

    // Allow non-browser or same-host requests without Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const limiterGeneral = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { message: 'Demasiadas solicitudes, intenta mas tarde' },
  standardHeaders: true,
  legacyHeaders: false
});

const limiterAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Demasiados intentos de inicio de sesion' },
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'rifatela-backend' });
});

app.use('/api', limiterGeneral);
app.use('/api/auth/login', limiterAuth);

app.use('/api/raffles', rafflesRoutes);
app.use('/api/auth', authRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'rifatela-backend',
    status: 'online',
    health: '/api/health'
  });
});

app.use((err, _req, res, next) => {
  if (!err) return next();

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origen no permitido por CORS' });
  }

  return res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log('Mode: API only');
});

function parseCorsOrigins(rawValue) {
  if (rawValue == null || rawValue === true || rawValue === 'true') {
    return true;
  }

  const stringValue = String(rawValue).trim();
  if (stringValue === '' || stringValue === '*') {
    return true;
  }

  const list = stringValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return list.length > 0 ? list : true;
}
