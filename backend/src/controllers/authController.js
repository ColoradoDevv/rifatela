const User = require('../models/user.model');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rifatela-admin-secret-change-in-production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contrasena son obligatorios' });
    }

    const trimmedUsername = username.trim();
    const user = await User.findOne({ username: trimmedUsername });

    if (!user) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const payload = { userId: user._id, username: user.username, role: user.role };
    const maxAge = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: maxAge });

    res.cookie('auth_token', token, { ...COOKIE_OPTIONS, maxAge: maxAge * 1000 });
    res.json({
      success: true,
      message: 'Sesion iniciada',
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al iniciar sesion', error: err.message });
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax' });
  res.json({ success: true, message: 'Sesion cerrada' });
};

// GET /api/auth/me
exports.me = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  res.json({
    success: true,
    user: { id: req.user.userId, username: req.user.username, role: req.user.role }
  });
};

// POST /api/auth/users/sellers
exports.createSeller = async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contrasena son obligatorios' });
    }

    const trimmedUsername = username.trim();
    const existing = await User.findOne({ username: trimmedUsername });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese nombre' });
    }

    const seller = new User({
      username: trimmedUsername,
      password,
      email: email || undefined,
      role: 'seller'
    });

    await seller.save();

    res.status(201).json({
      success: true,
      message: 'Vendedor creado correctamente',
      user: {
        id: seller._id,
        username: seller.username,
        email: seller.email || null,
        role: seller.role,
        createdAt: seller.createdAt
      }
    });
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      const firstError = Object.values(err.errors || {})[0];
      const detail = firstError?.message || err.message || 'Datos invalidos';
      return res.status(400).json({ message: detail });
    }
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese nombre' });
    }
    res.status(500).json({ message: err?.message || 'Error al crear vendedor' });
  }
};

// GET /api/auth/users/sellers
exports.listSellers = async (_req, res) => {
  try {
    const sellers = await User.find({ role: 'seller' })
      .select('_id username email role createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, sellers });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener vendedores', error: err.message });
  }
};
