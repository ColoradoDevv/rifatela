# Rifatela Backend

API Node.js/Express para rifas y autenticacion usando Supabase (Postgres).

## Desarrollo local

1. Crea el schema en Supabase:
   - Ejecuta `backend/scripts/supabase-schema.sql` en SQL Editor.
2. Copia `backend/.env.example` a `backend/.env`.
3. Configura al menos:
   - `JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Instala dependencias:
   ```bash
   cd backend
   npm install
   ```
5. Ejecuta en desarrollo:
   ```bash
   npm run dev
   ```

API local: `http://localhost:5000/api`  
Healthcheck: `GET /api/health`

## Script de administrador

Para crear un admin inicial:
```bash
cd backend
npm run create-admin
```

## Despliegue en Railway

1. Crea un servicio en Railway apuntando a la carpeta `backend/`.
2. Variables de entorno minimas:
   - `NODE_ENV=production`
   - `JWT_SECRET=<valor largo y aleatorio>`
   - `SUPABASE_URL=https://<project-ref>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
   - `CORS_ORIGIN=https://tu-frontend.vercel.app`
3. En produccion usa `SERVE_FRONTEND=false` (o vacio) si el frontend vive en otro servicio.
4. Railway detecta `npm start` automaticamente.
5. Verifica en produccion:
   - `GET https://<tu-backend>.up.railway.app/api/health`

## Cookie/Auth recomendada para frontend separado

Si vas directo desde el navegador al dominio Railway (sin proxy), usa:
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`

Si usas proxy `/api` en Vercel (recomendado en este proyecto), puedes mantener defaults.
