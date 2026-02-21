# Rifatela Frontend

Frontend estatico (HTML/CSS/JS) preparado para Vercel.

## Como desplegar en Vercel

1. Crea un proyecto en Vercel usando la carpeta `frontend/` como Root Directory.
2. Agrega variable de entorno en Vercel:
   - `RAILWAY_API_BASE_URL=https://tu-backend.up.railway.app/api`
3. Deploy.

## Que incluye esta configuracion

- `vercel.json`:
  - rutas amigables (`/inicio`, `/rifas`, `/admin`, `/ventas`, etc.)
  - rewrites de assets (`/js/*`, `/css/*`, `/assets/*`, etc.)
- `api/[...path].js`:
  - proxy de `/api/*` hacia Railway usando `RAILWAY_API_BASE_URL`
  - mantiene cookies/sesion funcionando bajo el dominio del frontend

## Flujo recomendado

- Frontend: Vercel
- Backend API: Railway
- Frontend llama siempre a `/api/...` (ya implementado en `src/js/config.js`)
