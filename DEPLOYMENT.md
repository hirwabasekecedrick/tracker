# Public deployment

The local LAN setup is not a production deployment. For phones on unrelated networks, deploy the frontend and backend to public HTTPS hosts.

## Required services

- Frontend: Next.js host, for example Vercel.
- Backend: Node.js host with WebSocket support, for example Render, Railway, Fly.io, or a VPS behind Nginx.
- Database: managed PostgreSQL.

## Backend environment

Copy `be/.env.example` to the backend host and set:

- `DATABASE_URL`: managed PostgreSQL connection string.
- `JWT_SECRET`: long random secret.
- `CORS_ORIGINS`: exact frontend URL, for example `https://tracker.example.com`.
- `PORT`: host-provided port when required.

Run the database schema with:

```bash
cd be
npm ci
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run build
npm start
```

`SEED_ACCOUNTS_JSON` is used only by `npm run prisma:seed`. The running backend reads hashed accounts from the `Account` table and does not need account passwords in its runtime configuration.

The backend host must support long-lived WebSocket connections. Expose `/health` for health checks.

## Frontend environment

Set `NEXT_PUBLIC_API_URL` to the public backend URL, for example:

```text
https://api.tracker.example.com
```

Build and start:

```bash
cd fe
npm ci
npm run build
npm start
```

## Test from unrelated networks

1. Open the deployed frontend URL on the driver's phone.
2. Log in and allow location access.
3. Start the journey.
4. Open the deployed frontend on the admin device and log in as an admin.
5. Confirm the driver marker and route update live.

HTTPS is required by mobile browser geolocation. Do not use `localhost` or a private LAN address for a real deployment.

## Production blockers still to address

The current demo backend keeps accounts and journey paths in process memory and contains demo passwords. Before selling this system, replace the in-memory maps with Prisma models, hash passwords with Argon2 or bcrypt, add real account provisioning and role authorization, and persist location points and journeys in PostgreSQL.
