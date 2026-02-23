/**
 * Crear un usuario administrador directamente en Supabase.
 * Uso (desde la carpeta backend): npm run create-admin
 * Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  const username = (await ask('Usuario (username): ')).trim();
  const password = (await ask('Contrasena: ')).trim();
  const email = (await ask('Email (opcional): ')).trim();

  if (!username || !password) {
    console.error('Usuario y contrasena son obligatorios.');
    process.exit(1);
  }

  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || 'Error consultando usuarios');
  }

  if (existing) {
    console.error('Ya existe un usuario con ese username.');
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { error: insertError } = await supabase
    .from('users')
    .insert({
      username,
      email: email || null,
      password: hashedPassword,
      role: 'admin'
    });

  if (insertError) {
    throw new Error(insertError.message || 'Error creando admin');
  }

  console.log('\nUsuario administrador creado correctamente.');
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
