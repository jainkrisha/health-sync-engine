# HealthSync Engine

## Quick start

Needs [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
cp .env.example .env                             # copy, then set a real JWT_SECRET
docker compose up --build -d                     # start MongoDB, server, app
docker compose exec server node dist/seed.js     # demo data (once)
```

Open **http://localhost:8080**. Password for every demo account: `password123`.

| Pass | IDs |
|---|---|
| PHC | `worker1` … `worker5` |
| Admin | `admin`, `reviewer`, `auditor` |

Stop: `docker compose down` · Reset demo data: `docker compose exec server node dist/seed.js --reset`

An offline-first, conflict-resolving health record system for field health workers (rural clinics, home visits, mobile health camps, disaster response). Group 17 mini project.

Every device is a full Progressive Web App that keeps patient records encrypted on the device and works with no network. When devices reconnect, their edits sync through a Node.js server that merges them **field by field** using vector clocks and CRDT rules:

| Field | Merge rule | What it guarantees |
|---|---|---|
| Name, date of birth, gender, blood type, contact, medication dates | Last-Write-Wins register (vector clock, then timestamp) | Newer edit wins; concurrent edits resolve the same way on every device |
| Allergies | OR-Set, add-wins | An allergy added on any device is never lost; a delete only removes what the deleting device had seen |
| Medication dose, frequency, stop/start | Critical field | Concurrent different values are **never** auto-merged; they go to a clinical reviewer |
| Vitals | Grow-only set of readings | Every reading from every device is kept as history |

Every decision (automatic or manual) is written to an append-only audit trail.

## Features

- **Offline-first PWA**: installable, app shell cached by a service worker, all reads and writes go to IndexedDB first.
- **Encrypted at rest**: patient records and the outbox are AES-256-GCM ciphertext in IndexedDB (Web Crypto, non-extractable per-device key).
- **Real-time sync**: Socket.io push/pull with acknowledgements, automatic resync on reconnect, live updates from other devices.
- **Vector clocks** on every field to tell genuine conflicts from stale writes.
- **Conflict Review dashboard** for clinical reviewers: both values side by side with device and clock, keep A, keep B, or enter a corrected dose.
- **Audit Trail**: filter by patient, date range, automatic vs manual; read-only.
- **Two sign-in portals**: **PHC** for the local doctor at a Primary Health Centre (full offline support, data syncs when the network returns) and **Admin** for the central system at the district hospital (every PHC's records, conflict review, audit trail, users and devices). An account only opens in its own portal.
- **JWT auth with 4 roles** (health worker, clinical reviewer, admin, auditor) enforced on the server and in the UI.
- **Admin page**: change user roles, see registered devices and who is online.
- **Dashboard**: synced vs pending chart, auto-resolution rate, system stats.
- Dark mode, responsive layout, keyboard and screen-reader friendly.
- **Demo mode**: "Simulate offline" switch, and `?device=B` in a second tab to act as a second device.

## Tech stack

| Layer | Tech |
|---|---|
| Client | React 19, Vite, TypeScript, Tailwind CSS 3, React Router 7, React Hook Form + Zod, Dexie (IndexedDB), socket.io-client, Recharts, vite-plugin-pwa |
| Server | Node.js 22, Express 5, Socket.io 4, Mongoose 8, JWT, bcrypt, Zod |
| Database | MongoDB 7 (server), IndexedDB (each device) |
| Shared | `shared/`: types, vector clocks, merge engine, used by both client and server |
| Tests | Vitest (merge engine, API), Playwright (two-device and offline end-to-end) |
| Deploy | Docker Compose (mongo + server + nginx client) |

## Run it

### Option 1: Docker (whole stack)

```bash
cp .env.example .env          # set JWT_SECRET
docker compose up --build
docker compose exec server node dist/seed.js   # optional demo data
```

Open http://localhost:8080.

### Option 2: Local development

Needs Node 22+ and a MongoDB on `localhost:27017` (or set `MONGO_URI`).

```bash
cd server
npm install
cp .env.example .env
npm run seed                   # demo users and patients (once)
npm run dev                    # API + sync on http://localhost:4000

cd ../client                   # in a second terminal
npm install
npm run dev                    # PWA on http://localhost:5173 (proxies /api and /socket.io)
```

Demo logins after seeding (password `password123`):

| Portal | Accounts |
|---|---|
| PHC | `worker1` (PHC Wagholi), `worker2` (PHC Lonikand), `worker3`–`worker5` (Hadapsar, Uruli Kanchan, Khed) |
| Admin (District Hospital) | `admin`, `reviewer`, `auditor` |
 The seed includes one pending medication conflict on Asha Patil.

### Environment variables (server)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 4000 | API port |
| `MONGO_URI` | `mongodb://localhost:27017/healthsync` | MongoDB connection |
| `JWT_SECRET` | dev-only default (required in production) | Token signing |
| `JWT_EXPIRES_IN` | `7d` | Session length (devices can work offline until it expires) |
| `CLIENT_ORIGIN` | `http://localhost:5173,http://localhost:4173` | Allowed browser origins |
| `ALLOW_OPEN_REGISTRATION` | `false` | Allow self-registration with any role (set `true` for open demo). Demo users are created by the seed script, not self-registration. |

## Tests

```bash
cd client
npm test                 # merge engine and vector clock unit tests (shared/)
npm run test:server      # API, RBAC, sync, conflicts, Socket.io (uses MONGO_URI_TEST or an in-memory MongoDB)
npm run test:e2e         # Playwright, against a running stack (E2E_BASE_URL, default http://localhost:5173)
```

The offline e2e test needs the production build (`npm run build && npm run preview`, then `E2E_BASE_URL=http://localhost:4173`).

## Demo script

See [docs/DEMO.md](docs/DEMO.md) for the two-device walkthrough used in the presentation.

## Project structure

```
client/              React PWA (Vite), its Dockerfile and nginx config
  src/crypto/        AES-GCM encryption and device key
  src/db/            Dexie schema, encrypted patient repository, mutation outbox
  src/sync/          syncEngine (Socket.io client, push/pull, reconnect)
  src/context/       Auth (JWT), RBAC guards, theme
  src/pages/         Login, Dashboard, PatientList, PatientForm, PatientDetail,
                     ConflictDashboard, AuditTrail, Admin
  e2e/               Playwright end-to-end tests
server/              Express + Socket.io + Mongoose, and its Dockerfile
  src/models/        User, Patient, MutationLog, Conflict, AuditEntry, Device, Counter
  src/routes/        auth, patients, sync, conflicts, audit-log, users, devices, stats
  src/services/      syncService (merge authority), conflictService, auditService
  src/socket.ts      real-time sync transport
shared/              types, vector clocks, CRDT merge engine, form diff (client + server)
docs/                PRD, Architecture, Demo script, project memory and AI rules
docker-compose.yml   mongo + server + client
```

See [docs/Architecture.md](docs/Architecture.md) for how sync and merging work.
