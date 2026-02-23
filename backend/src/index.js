const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
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

const frontendEnabled = mountFrontend(app, {
  serveFrontend: isTruthy(process.env.SERVE_FRONTEND),
  frontendSrcDir: path.resolve(__dirname, '../../frontend/src')
});

if (!frontendEnabled) {
  app.get('/', (_req, res) => {
    res.status(200).json({
      service: 'rifatela-backend',
      status: 'online',
      health: '/api/health'
    });
  });
}

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
  console.log(frontendEnabled ? 'Mode: API + Frontend routes' : 'Mode: API only');
});

function mountFrontend(appInstance, options) {
  const { serveFrontend, frontendSrcDir } = options;
  if (!serveFrontend) {
    return false;
  }

  const frontendViewsDir = path.join(frontendSrcDir, 'views');
  if (!fs.existsSync(frontendSrcDir) || !fs.existsSync(frontendViewsDir)) {
    console.warn('WARN: SERVE_FRONTEND=true but frontend/src was not found. Running API only.');
    return false;
  }

  const staticPaths = [
    ['/src', frontendSrcDir],
    ['/css', path.join(frontendSrcDir, 'css')],
    ['/js', path.join(frontendSrcDir, 'js')],
    ['/assets', path.join(frontendSrcDir, 'assets')],
    ['/config', path.join(frontendSrcDir, 'config')],
    ['/components', path.join(frontendSrcDir, 'components')],
    ['/views', path.join(frontendSrcDir, 'views')]
  ];

  staticPaths.forEach(([route, dirPath]) => {
    if (fs.existsSync(dirPath)) {
      appInstance.use(route, express.static(dirPath));
    }
  });

  const viewRoutes = {
    '/': 'index.html',
    '/inicio': 'index.html',
    '/rifas': 'rifas.html',
    '/login': 'auth/login.html',
    '/admin': 'admin/dashboard.html',
    '/dashboard': 'admin/dashboard.html',
    '/admin/vendedores': 'admin/new-sellers.html',
    '/admin/new-sellers': 'admin/new-sellers.html',
    '/ventas': 'seller/register-sale.html',
    '/admin/register-sale': 'seller/register-sale.html',
    '/ganadores': 'index.html',
    '/soporte': 'index.html'
  };

  Object.entries(viewRoutes).forEach(([route, relativeViewPath]) => {
    const routeVariants = route === '/' ? ['/'] : [route, `${route}/`];
    const absoluteViewPath = path.join(frontendViewsDir, relativeViewPath);
    routeVariants.forEach((variant) => {
      appInstance.get(variant, (_req, res) => {
        res.sendFile(absoluteViewPath);
      });
    });
  });

  return true;
}

function isTruthy(value) {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

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
