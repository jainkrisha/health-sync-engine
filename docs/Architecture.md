# Architecture — HealthSync

This describes the architecture across both build phases. **Phase A (current) is client-only.** Phase B (sync/CRDT) is designed here but not yet built — do not scaffold Phase B code during Phase A work unless explicitly asked.

---

## 1. Phase A Architecture (current — local-first PWA)

```
Browser (PWA)
  ├── React Router v6            → routing / navigation
  ├── React Hook Form + Zod      → form state + validation
  ├── Dexie.js                    → IndexedDB wrapper (on-device store)
  ├── vite-plugin-pwa             → installability + offline app shell caching
  └── TailwindCSS                 → styling
```

No backend exists in Phase A. All reads/writes go straight to IndexedDB through `src/db/db.ts`. There are no network calls in this phase — not even for auth (auth is a local stub).

### Tech stack (Phase A, locked)
- React 18 + Vite + TypeScript
- TailwindCSS v3
- React Router v6
- Dexie.js (IndexedDB)
- React Hook Form + Zod
- vite-plugin-pwa

### Folder structure (Phase A, ownership per Week 1 split)
```
src/
  db/                 → Dexie schema + typed CRUD helpers (Person A owns; stable exports)
  types/              → Patient interface, shared types (Person A owns)
  context/            → AuthContext (Person A owns)
  layout/             → app shell, sidebar, offline/online badge (Person A owns)
  routes.tsx          → route table (Person A owns exclusively)
  pages/
    Login/            → Person A
    Dashboard/         → Person B
    PatientList/        → Person B
    PatientForm/         → Person C
  components/          → shared presentational components, additive-only per owner
  schemas/            → Zod schemas (Person C owns: patientSchema.ts)
  hooks/              → usePatients.ts (Person B), usePatientForm.ts (Person C)
  App.tsx / main.tsx
```

### Data flow (Phase A)
```
User action → React form / UI
  → hook (usePatients / usePatientForm)
    → db/db.ts (addPatient / updatePatient / getAllPatients / getPatientById / deletePatient)
      → Dexie → IndexedDB
```
No field is ever sent over the network in this phase.

---

## 2. Phase B Architecture (future — sync + CRDT merge, not yet built)

Adds a backend and a conflict-resolution layer on top of Phase A's local store. **Locked decision: the local store stays on IndexedDB/Dexie** — no move to SQLite. Moving to SQLite would require a native/Capacitor shell for filesystem access, which conflicts with the PWA-only non-goal in PRD.md, and it would throw away the Phase A `db.ts` investment for no benefit. Vector clock stamping gets added to the existing Dexie write helpers in Phase B, not to a new storage layer.

```
Device A (IndexedDB)          Device B (IndexedDB)
     |  local edits, vector-clock stamped   |
     |                                       |
     └──────────────┐         ┌──────────────┘
                     ▼         ▼
              Sync Agent (delta push/pull)
                     │
                     ▼
              Backend Sync Endpoint
                     │
                     ▼
              Merge Engine (CRDT resolver)
              ├── LWW-Register       → simple fields
              ├── Set-CRDT add-wins  → allergy set
              └── Critical-flag      → medication dosage → human review queue
                     │
                     ▼
              Canonical store + change_log (audit trail)
```

### Vector clock format
`{ device_id: counter }` — incremented on every local write, merged via element-wise max, compared to classify edits as dominates / dominated / concurrent.

### Backend stack (locked)
**Node.js** (Express or Fastify) — keeps the whole stack in TypeScript, and the Zod schemas / `Patient` type from Phase A can be shared directly with the backend instead of re-implemented in a second language.

### Field resolution rules (non-negotiable, see PRD §6)
| Field type | Resolver | Rule |
|---|---|---|
| name, bloodType, DOB, vitals | LWW-Register | Later vector clock wins |
| allergies | Set-CRDT | Add-wins, tombstoned deletes, never silently dropped |
| medication dosage | Critical-flag | Never auto-resolved — always routed to human review |

### Audit trail
Every merge decision (accepted / conflict-flagged / server-has-newer) is appended to `change_log`. This table is append-only — never update or delete rows in it.

---

## 3. Boundary Between Phases
Phase A code must not import or assume Phase B exists (no sync calls, no vector-clock fields on writes yet). When Phase B starts, the vector-clock stamp gets wired into `db/db.ts`'s write helpers — that will be a deliberate, tracked change, not an incidental one.
