/**
 * Crear un usuario administrador directamente en la base de datos.
 * Uso (desde la carpeta backend): npm run create-admin
 * Requiere MONGO_URI en .env. Las cuentas solo se crean así, no hay registro público.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const readline = require('readline');

const User = require('../src/models/user.model');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rifatela';
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB\n');

  const username = await ask('Usuario (username): ');
  const password = await ask('Contraseña: ');

  if (!username || !password) {
    console.error('Usuario y contraseña son obligatorios.');
    process.exit(1);
  }

  const existing = await User.findOne({ username });
  if (existing) {
    console.error('Ya existe un usuario con ese username.');
    process.exit(1);
  }

  const user = new User({ username, password, role: 'admin' });
  await user.save();
  console.log('\nUsuario administrador creado correctamente.');
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
