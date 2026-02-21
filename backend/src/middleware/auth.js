const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rifatela-admin-secret-change-in-production';

function requireAuth(req, res, next) {
  const token = req.cookies?.auth_token || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role };
    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Sesion invalida o expirada' });
  }
}

function requireAuthRedirect(req, res, next) {
  const token = req.cookies?.auth_token;
  const requestedPath = req.originalUrl || req.path || '/admin';
  const loginRedirect = `/login?redirect=${encodeURIComponent(requestedPath)}`;

  if (!token) {
    return res.redirect(302, loginRedirect);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { userId: decoded.userId, username: decoded.username, role: decoded.role };
    next();
  } catch (_err) {
    res.clearCookie('auth_token', { httpOnly: true, sameSite: 'lax' });
    return res.redirect(302, loginRedirect);
  }
}

function requireRole(...roles) {
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tienes permisos para esta accion' });
    }
    next();
  };
}

function requireAuthRedirectRole(...roles) {
  const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;

  return (req, res, next) => {
    requireAuthRedirect(req, res, () => {
      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return res.redirect(302, '/login');
      }
      next();
    });
  };
}

module.exports = { requireAuth, requireAuthRedirect, requireRole, requireAuthRedirectRole };
