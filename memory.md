# memory.md — Living Project State

Update this file at the end of every work session, before switching tools or chats. Keep entries short and factual — this file exists so an AI tool can resume work without re-reading the whole codebase or re-deriving decisions already made.

**How to update:** append to the relevant section below; don't rewrite history. Move items from "In Progress" to "Completed" as they finish. Add new items to "Open Decisions" the moment a choice needs to be made but hasn't been — don't let them stay implicit.

---

## Current Phase
Phase A — local-first CRUD shell (in progress)

## Completed
- 2026-08-03: Scaffolded React 18 + Vite + TypeScript project (create-vite react-ts template)
- 2026-08-03: Installed TailwindCSS v3 with custom medical color palette (medical/teal/slate tokens)
- 2026-08-03: Installed React Router v6, Dexie v4, React Hook Form, Zod v4, @hookform/resolvers
- 2026-08-03: Configured ESLint (flat config), Prettier + prettier-plugin-tailwindcss
- 2026-08-03: Created full folder structure: db/, types/, context/, layout/, pages/*, components/, hooks/, schemas/
- 2026-08-03: Person A files: src/types/patient.ts, src/db/db.ts, src/context/AuthContext.tsx, src/layout/AppLayout.tsx, src/layout/OfflineBadge.tsx, src/routes.tsx, src/App.tsx, src/main.tsx
- 2026-08-03: Person B stubs: src/pages/Dashboard/DashboardPage.tsx, src/pages/PatientList/PatientListPage.tsx, src/hooks/usePatients.ts
- 2026-08-03: Person C stubs: src/pages/PatientForm/PatientFormPage.tsx, src/schemas/patientSchema.ts, src/hooks/usePatientForm.ts
- 2026-08-03: Build verified: tsc + vite build → zero errors, zero warnings

## In Progress
_(none)_

## Blockers
_(none)_

## Open Decisions
_(none currently open)_

## Decisions Log
- 2026-08-02: Phase B backend language locked to **Node.js**. Reason: keeps the whole stack in TypeScript, and Zod schemas/types from Phase A can be shared with the backend instead of ported to a second language.
- 2026-08-02: Phase B local storage stays on **IndexedDB/Dexie** (no move to SQLite). Reason: PRD's Phase A non-goals rule out a native app — PWA only — and SQLite would require a native/Capacitor shell to get filesystem access, which contradicts that. Staying on Dexie also preserves the Phase A `db.ts` investment instead of rewriting it for Phase B.
- 2026-08-03: Zod v4 installed (4.4.x). `required_error` param removed in v4; use `.min(1, msg)` for required strings. Enum patterns also changed — see patientSchema.ts.
- 2026-08-03: Dexie v4 installed (4.4.x). Class-extends pattern still supported; `Table` must be imported separately. PK add() returns `IndexableType` — cast to `number` explicitly.

## Next Steps
- Person A: Implement Login page (stub auth form → calls AuthContext.login())
- Person B: Implement Dashboard (summary cards) and PatientList (table with search)
- Person C: Implement PatientForm (React Hook Form + zodResolver + patientSchema)
- All: Wire usePatients + usePatientForm hooks to Dexie live queries
