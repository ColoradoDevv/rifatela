/**
 * Validación de variables de entorno requeridas.
 * El servidor debe fallar al iniciar si faltan variables críticas.
 */
require('dotenv').config();

const required = [
  'JWT_SECRET'
];

const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  console.error('ERROR: Faltan variables de entorno requeridas:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('\nCrea un archivo .env con estas variables. En producción JWT_SECRET debe ser un valor aleatorio y seguro.');
  process.exit(1);
}

/** JWT secret para firmar tokens. Nunca usar valor por defecto en producción. */
const JWT_SECRET = process.env.JWT_SECRET;

/** Origen permitido para CORS. En producción definir CORS_ORIGIN (ej: https://tudominio.com) */
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

/** Entorno: development | production */
const NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
  JWT_SECRET,
  CORS_ORIGIN,
  NODE_ENV
};
