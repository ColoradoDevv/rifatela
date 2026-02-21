const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { CORS_ORIGIN } = require('./config/env');
const rafflesRoutes = require('./routes/raffles');
const authRoutes = require('./routes/auth');
const { requireAuthRedirectRole } = require('./middleware/auth');

connectDB();

const app = express();

app.use(cors({
  origin: CORS_ORIGIN === true || CORS_ORIGIN === 'true' ? true : CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) || true,
  credentials: true
}));
app.use(express.json());
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

app.use('/api/', limiterGeneral);
app.use('/api/auth/login', limiterAuth);

// API Routes (must be before static files)
app.use('/api/raffles', rafflesRoutes);
app.use('/api/auth', authRoutes);

// Serve static files from frontend/src
const frontendPath = path.join(__dirname, '../../frontend/src');
app.use(express.static(frontendPath));

// Friendly routes
app.get('/inicio', (req, res) => {
  res.sendFile(path.join(frontendPath, 'views/index.html'));
});

app.get('/rifas', (req, res) => {
  res.sendFile(path.join(frontendPath, 'views/rifas.html'));
});

app.get('/admin', requireAuthRedirectRole('admin'), (req, res) => {
  res.sendFile(path.join(frontendPath, 'views/admin/dashboard.html'));
});

app.get('/dashboard', requireAuthRedirectRole('admin'), (req, res) => {
  res.redirect(302, '/admin');
});

app.get('/admin/vendedores', requireAuthRedirectRole('admin'), (req, res) => {
  res.sendFile(path.join(frontendPath, 'views/admin/new-sellers.html'));
});

app.get('/admin/new-sellers', requireAuthRedirectRole('admin'), (req, res) => {
  res.redirect(302, '/admin/vendedores');
});

app.get('/ventas', requireAuthRedirectRole('admin', 'seller'), (req, res) => {
  res.sendFile(path.join(frontendPath, 'views/seller/register-sale.html'));
});

app.get('/admin/register-sale', requireAuthRedirectRole('admin', 'seller'), (req, res) => {
  res.redirect(302, '/ventas');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'views/auth/login.html'));
});

app.get('/ganadores', (req, res) => {
  // If ganadores.html exists, serve it, otherwise serve index.html
  const ganadoresPath = path.join(frontendPath, 'views/ganadores.html');
  const fs = require('fs');
  if (fs.existsSync(ganadoresPath)) {
    res.sendFile(ganadoresPath);
  } else {
    res.sendFile(path.join(frontendPath, 'views/index.html'));
  }
});

app.get('/soporte', (req, res) => {
  // If soporte.html exists, serve it, otherwise serve index.html
  const soportePath = path.join(frontendPath, 'views/soporte.html');
  const fs = require('fs');
  if (fs.existsSync(soportePath)) {
    res.sendFile(soportePath);
  } else {
    res.sendFile(path.join(frontendPath, 'views/index.html'));
  }
});

// Root route redirects to inicio
app.get('/', (req, res) => {
  res.redirect('/inicio');
});

// Catch all handler: send back React's index.html file for client-side routing
app.get('*', (req, res) => {
  // If it's an API route, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  
  // Try to serve the file, if not found, serve index.html
  const requestedPath = path.join(frontendPath, req.path);
  const fs = require('fs');
  
  if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
    res.sendFile(requestedPath);
  } else {
    // Default to index.html for SPA-like behavior
    res.sendFile(path.join(frontendPath, 'views/index.html'));
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log(`Frontend served from: ${frontendPath}`);
  console.log(`Available routes:`);
  console.log(`  - http://localhost:${PORT}/inicio (or /)`);
  console.log(`  - http://localhost:${PORT}/rifas`);
  console.log(`  - http://localhost:${PORT}/admin`);
  console.log(`  - http://localhost:${PORT}/admin/vendedores`);
  console.log(`  - http://localhost:${PORT}/ventas`);
  console.log(`  - http://localhost:${PORT}/login`);
  console.log(`  - http://localhost:${PORT}/ganadores`);
  console.log(`  - http://localhost:${PORT}/soporte`);
  console.log(`  - http://localhost:${PORT}/api/raffles/* (API endpoints)`);
});
