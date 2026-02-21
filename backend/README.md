# Rifas Backend

Instrucciones rápidas:

- Copia `.env.example` a `.env` y ajusta `MONGO_URI` y `PORT`.
- Instala dependencias: `npm install`.
- Para desarrollo: `npm run dev` (requiere `nodemon`).
- API base: `http://localhost:4000/api/raffles`.

Endpoints:
- `GET /api/raffles` - listar rifas
- `POST /api/raffles` - crear raffle
- `POST /api/raffles/:id/buy` - comprar ticket (body: `{name,email}`)
- `POST /api/raffles/:id/draw` - sortear ganador
