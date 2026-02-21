# Rifatela Backend

API Node.js/Express para rifas y autenticacion.

## Desarrollo local

1. Copia `backend/.env.example` a `backend/.env`.
2. Configura al menos `JWT_SECRET` y `MONGO_URI`.
3. Instala dependencias:
   ```bash
   cd backend
   npm install
   ```
4. Ejecuta en desarrollo:
   ```bash
   npm run dev
   ```

API local: `http://localhost:5000/api`
Healthcheck: `GET /api/health`

## Despliegue en Railway

1. Crea un servicio en Railway apuntando a la carpeta `backend/`.
2. Variables de entorno minimas:
   - `NODE_ENV=production`
   - `JWT_SECRET=<valor largo y aleatorio>`
   - `MONGO_URI=<mongodb connection string>`
   - `CORS_ORIGIN=https://tu-frontend.vercel.app`
3. Railway detecta `npm start` automaticamente.
4. Verifica en produccion:
   - `GET https://<tu-backend>.up.railway.app/api/health`

## Cookie/Auth recomendada para frontend separado

Si vas directo desde el navegador al dominio Railway (sin proxy), usa:
- `COOKIE_SECURE=true`
- `COOKIE_SAMESITE=none`

Si usas proxy `/api` en Vercel (recomendado en este proyecto), puedes mantener defaults.
