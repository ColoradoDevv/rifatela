const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { buildAuthCookieOptions } = require('../config/cookies');
const { supabase, isNoRowsError } = require('../config/supabase');

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contrasena son obligatorios' });
    }

    const trimmedUsername = username.trim();
    const { data: user, error } = await supabase
      .from('users')
      .select('id,username,password,role')
      .eq('username', trimmedUsername)
      .maybeSingle();

    if (error && !isNoRowsError(error)) {
      throw new Error(error.message || 'Error consultando usuario');
    }

    if (!user) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const payload = { userId: user.id, username: user.username, role: user.role };
    const maxAge = remember ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: maxAge });

    res.cookie('auth_token', token, buildAuthCookieOptions(maxAge * 1000));
    res.json({
      success: true,
      message: 'Sesion iniciada',
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al iniciar sesion', error: err.message });
  }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('auth_token', buildAuthCookieOptions());
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
    const { data: existing, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmedUsername)
      .maybeSingle();

    if (existingError && !isNoRowsError(existingError)) {
      throw new Error(existingError.message || 'Error consultando usuario');
    }

    if (existing) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese nombre' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: seller, error: insertError } = await supabase
      .from('users')
      .insert({
        username: trimmedUsername,
        password: hashedPassword,
        email: email || null,
        role: 'seller'
      })
      .select('id,username,email,role,created_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({ message: 'Ya existe un usuario con ese nombre' });
      }
      throw new Error(insertError.message || 'Error insertando vendedor');
    }

    res.status(201).json({
      success: true,
      message: 'Vendedor creado correctamente',
      user: mapUserRow(seller)
    });
  } catch (err) {
    res.status(500).json({ message: err?.message || 'Error al crear vendedor' });
  }
};

// GET /api/auth/users/sellers
exports.listSellers = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,username,email,role,created_at')
      .eq('role', 'seller')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Error consultando vendedores');
    }

    const sellers = (data || []).map(mapUserRow);

    res.json({ success: true, sellers });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener vendedores', error: err.message });
  }
};
